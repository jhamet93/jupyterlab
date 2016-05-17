// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

import {
  IKernel, IExecuteReply
} from 'jupyter-js-services';

import {
  ObservableList
} from 'phosphor-observablelist';

import {
  IOutput, IStream, isStream
} from '../notebook/nbformat';


/**
 * An observable list that handles output area data.
 */
export
class ObservableOutputs extends ObservableList<IOutput> {
  /**
   * Add an output, which may be combined with previous output
   * (e.g. for streams).
   */
  add(output: IOutput) {
    // If we received a delayed clear message, then clear now.
    if (this._clearNext) {
      this.clear();
      this._clearNext = false;
    }

    // Consolidate outputs if they are stream outputs of the same kind.
    let lastOutput = this.get(-1) as IStream;
    if (isStream(output)
        && lastOutput && isStream(lastOutput)
        && output.name === lastOutput.name) {
      // In order to get a list change event, we add the previous
      // text to the current item and replace the previous item.
      // This also replaces the metadata of the last item.
      let text: string = output.text;
      output.text = lastOutput.text as string + text;
      this.set(-1, output);
    } else {
      switch (output.output_type) {
      case 'stream':
      case 'execute_result':
      case 'display_data':
      case 'error':
        super.add(output);
        break;
      default:
        break;
      }
    }
  }

  /**
   * Clear all of the output.
   *
   * @param wait Delay clearing the output until the next message is added.
   */
  clear(wait: boolean = false) {
    if (wait) {
      this._clearNext = true;
    } else {
      super.clear();
    }
  }

  private _clearNext = false;
}


/**
 * Execute code on a kernel and send outputs to an observable output.
 */
export
function executeCode(code: string, kernel: IKernel, output: ObservableOutputs): Promise<IExecuteReply> {
  let exRequest = {
    code,
    silent: false,
    store_history: true,
    stop_on_error: true,
    allow_stdin: true
  };
  outputs.clear(false);
  return new Promise<IExecuteReply>((resolve, reject) => {
    let future = kernel.execute(exRequest);
    future.onIOPub = (msg => {
      let model = msg.content;
      if (model !== void 0) {
        model.output_type = msg.header.msg_type as OutputType;
        output.add(model);
      }
    });
    future.onReply = (msg => {
      resolve(msg.content as IExecuteReply);
    });
  });
}
