import $ from 'jquery'

$(() => {

  // transition from type page into kucocoin
  for (const alignment of ['liberal', 'conservative']) {
    const other = alignment === 'liberal' ? 'conservative' : 'liberal'
    $(`#type-${alignment}`).on('mouseenter', 'span', () => {
      $(`#type-${other}`).css('opacity', '.2')
    })
    $(`#type-${alignment}`).on('mouseleave', 'span', () => {
      $(`#type-${other}`).css('opacity', '1')
    })
    $(`#type-${alignment} > span`).on('click', () => {
      $('#type-page').fadeOut(1000, () => {
        $(`#kucocoin-${alignment}-page`).fadeIn(1000)
      })
    })
  }

})