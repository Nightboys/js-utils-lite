import * as localTemplateSource from "./local.js";
import * as remoteTemplateSource from "./remote.js";

/**
 * 返回当前启用的模板源，本地与远程来源通过函数内返回语句显式切换。
 *
 * @returns {{listTemplates: Function, materializeTemplate: Function}} 模板源实现。
 */
export function getTemplateSource() {
  // 当前使用本地模板；启用远程时注释下一行，并取消随后一行的注释。
  return localTemplateSource;
  // return remoteTemplateSource;
}

export { localTemplateSource, remoteTemplateSource };
