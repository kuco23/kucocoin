import $ from 'jquery'
import { hashlink } from '../utils'


export function popupSuccess(title: string, text: string): void {
  $('#success-desc-0').text(title)
  if (text.startsWith('0x')) {
    $('#success-desc-1').html(hashlink(text))
  } else {
    $('#success-desc-1').text(text)
  }
  $('#windows95-success').show(0)
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
    return "No wallet installed"
  } else if (error.includes('(')) {
    return error.slice(0, error.indexOf('('))
  } else {
    return error;
  }
}