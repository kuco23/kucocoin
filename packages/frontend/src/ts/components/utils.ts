import $ from 'jquery'
import { sleep } from '../utils'
import { POPUP_SHOW_MS, POPUP_FADE_IN_MS, POPUP_FADE_OUT_MS } from "../config/display"


export function popupSuccess(text: string): void {
  $('#popup').text(text).css('color', 'lime').fadeIn(POPUP_FADE_IN_MS, () =>
    sleep(POPUP_SHOW_MS).then(() => $('#popup').fadeOut(POPUP_FADE_OUT_MS))
  )
}

export function popupError(title?: string, message?: string): void {
  if (title !== undefined)
    $('#error-desc-0').text(title)
  if (message !== undefined)
    $('#error-desc-1').text(formatErrorMessage(message))
  $('#windows95-error').show(0)
}

export function loadingStart(replaceDivId: string) {
  const $replaceDiv = $('#' + replaceDivId)
  const $loaderDiv = $('#' + replaceDivId + '-loader')
  const replaceDivHeight = $replaceDiv.parent().innerHeight()!
  $replaceDiv.hide().after($loaderDiv.innerHeight(replaceDivHeight).show())
}

export function loadingEnd(replaceDivId: string): void {
  $('#' + replaceDivId + '-loader').hide()
  $('#' + replaceDivId).show()
}

function formatErrorMessage(error: string): string {
  if (error.includes('execution reverted')) {
    return "smart contract call reverted with " + error.split('"')[1]
  } else if (error == 'Cannot read properties of undefined') {
    return "MetaMask not installed"
  } else if (error.includes('(')) {
    return error.slice(0, error.indexOf('('))
  } else {
    return error;
  }
}