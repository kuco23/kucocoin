import $ from 'jquery'
import { sleep } from '../utils'
import { POPUP_SHOW_MS, POPUP_FADE_IN_MS, POPUP_FADE_OUT_MS } from "../config/display"


export function popup(text: string, color: string): void {
  $('#popup').text(text).css('color', color).fadeIn(POPUP_FADE_IN_MS, () =>
    sleep(POPUP_SHOW_MS).then(() => $('#popup').fadeOut(POPUP_FADE_OUT_MS))
  )
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