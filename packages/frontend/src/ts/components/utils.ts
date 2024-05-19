import $ from 'jquery'
import { sleep } from '../utils'
import { POPUP_SHOW_MS, POPUP_FADE_IN_MS, POPUP_FADE_OUT_MS } from "../config/display"


export function popupSuccess(text: string): void {
  $('#popup').text(text).css('color', 'lime').fadeIn(POPUP_FADE_IN_MS, () =>
    sleep(POPUP_SHOW_MS).then(() => $('#popup').fadeOut(POPUP_FADE_OUT_MS))
  )
}

export function popupError(text: string): void {
  $('#error-desc-0').text(text)
  $('#windows95-error').show(POPUP_FADE_IN_MS)
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