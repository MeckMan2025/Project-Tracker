// The field, as a picture a scout can tap.
//
// Starting position was three strips labelled Left, Middle and Right. The
// trouble with words is whose left: a scout standing behind the opposite
// alliance wall reads them backwards, and nobody notices until the data is
// being used to pick an alliance. A picture with the driver station drawn on
// it has no left to get wrong.
//
// Everything here is coordinates, so the map can be corrected without touching
// the component that draws it. Numbers are percentages of the field — x across,
// y from the far wall down to your driver station — so they hold whatever
// shape the field is drawn at.

// Drop the official overhead picture of the field in at this path and it
// becomes the background, with the zones below laid on top of it. Until then
// the field is drawn: perimeter, midline and your alliance wall, and nothing
// invented about this season's game that might be wrong.
export const FIELD_IMAGE = '/field/field.png'

// How the field is drawn when there is no picture. Only the parts of a FIRST
// field that are true every season.
export const FIELD = {
  // A field is about twice as wide as the half you scout from.
  aspect: 100 / 62,
  midline: 0.42,     // how far down the drawn area the far half ends
  startLine: 0.70,   // the line robots line up behind
}

// The start areas, as boxes on that map. x/y are the top-left corner, w/h the
// size, all 0–1 of the drawn field. Three areas across the near third, which
// is where a robot can start: against the wall at either end, or in the middle.
//
// Keyed by the option exactly as scoutingFields.js lists it, so the value
// saved is unchanged — existing matches, the table, the CSV and the averages
// all still read the same three words.
export const START_ZONES = {
  Left:   { x: 0.05, y: 0.52, w: 0.28, h: 0.40 },
  Middle: { x: 0.36, y: 0.52, w: 0.28, h: 0.40 },
  Right:  { x: 0.67, y: 0.52, w: 0.28, h: 0.40 },
}

// Any option without a box above gets an even share of the same strip, so
// changing the options in scoutingFields.js cannot leave the map blank.
export function zonesFor(options = []) {
  const known = options.filter(o => START_ZONES[o])
  if (known.length === options.length) {
    return options.map(o => ({ option: o, ...START_ZONES[o] }))
  }
  const gap = 0.03
  const w = (0.90 - gap * (options.length - 1)) / options.length
  return options.map((o, i) => ({
    option: o,
    x: 0.05 + i * (w + gap),
    y: 0.52,
    w,
    h: 0.40,
  }))
}
