import { useState } from 'react'
import { FIELD, FIELD_IMAGE, spotsFor, zonesFor } from '../data/fieldMap'

// Tap the field to say where something was.
//
// Two questions use it. Where a robot started is one answer out of a few
// areas, so those are drawn as zones. Which flowers a team finished owning is
// several answers out of four fixed places, so those are drawn as marks
// standing where the flowers stand, and tapping one toggles it.
//
// The geometry lives in data/fieldMap.js — this only draws it. If the official
// overhead picture of the field is sitting at FIELD_IMAGE it goes underneath
// the zones; if it isn't there, or a phone can't load it, the field is drawn
// instead and the input works exactly the same. A scout at a competition with
// no signal must never be left with a broken picture and no way to answer.
//
// The value saved is the zone's own option string, unchanged from when this
// was three buttons, so everything already recorded still reads the same.

export default function FieldMap({ value, onChange, options = [], multi = false }) {
  const [hasImage, setHasImage] = useState(true)
  const zones = multi ? [] : zonesFor(options)
  const spots = multi ? spotsFor(options) : []
  const pct = (n) => `${n * 100}%`

  // Several answers are stored exactly as the tick-all inputs store them — a
  // comma-joined list — so nothing downstream can tell the difference between
  // a flower ticked off a list and the same flower tapped on the map.
  const picked = multi ? String(value || '').split(',').filter(Boolean) : []
  const toggle = (opt) => onChange(
    (picked.includes(opt) ? picked.filter(x => x !== opt) : [...picked, opt]).join(',')
  )

  return (
    <div>
      <div
        className="relative w-full rounded-xl overflow-hidden border-2 border-pastel-yellow-dark/30 bg-gray-100 select-none"
        style={{ aspectRatio: String(FIELD.aspect) }}
      >
        {hasImage && (
          <img
            src={FIELD_IMAGE}
            alt=""
            onError={() => setHasImage(false)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* The field as drawn: the far half, the line robots line up behind,
            and your alliance wall at the bottom. Nothing here is specific to
            this season's game — a guessed goal in the wrong corner would be
            worse than no goal at all. */}
        {!hasImage && (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-gray-200 via-gray-100 to-gray-50" />
            <div
              className="absolute inset-x-0 border-b-2 border-dashed border-gray-300"
              style={{ top: pct(FIELD.midline), height: 0 }}
            />
            <div
              className="absolute inset-x-0 border-b border-pastel-blue-dark/40"
              style={{ top: pct(FIELD.startLine), height: 0 }}
            />
            <span className="absolute top-1 left-2 text-[9px] font-medium text-gray-400">
              Far side
            </span>
          </>
        )}

        {zones.map(z => {
          const on = value === z.option
          return (
            <button
              key={z.option}
              type="button"
              onClick={() => onChange(on ? '' : z.option)}
              aria-pressed={on}
              className={`absolute rounded-lg border-2 transition-colors flex flex-col items-center justify-end pb-1 ${
                on
                  ? 'border-pastel-yellow-dark bg-pastel-yellow/70 shadow-sm'
                  : 'border-white/70 bg-white/25 hover:bg-pastel-yellow/35'
              }`}
              style={{ left: pct(z.x), top: pct(z.y), width: pct(z.w), height: pct(z.h) }}
            >
              {/* Where the robot is, so the answer reads as a position on the
                  field rather than a highlighted rectangle. */}
              {on && (
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-pastel-yellow-dark border border-gray-700/40" />
              )}
              <span className={`text-[10px] font-semibold ${on ? 'text-gray-900' : 'text-gray-500'}`}>
                {z.option}
              </span>
            </button>
          )
        })}

        {spots.map(sp => {
          const on = picked.includes(sp.option)
          return (
            <button
              key={sp.option}
              type="button"
              onClick={() => toggle(sp.option)}
              aria-pressed={on}
              title={sp.option}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 flex items-center justify-center transition-colors ${
                on
                  ? 'border-pastel-yellow-dark bg-pastel-yellow text-gray-900 shadow-sm'
                  : 'border-white/80 bg-white/35 text-gray-500 hover:bg-pastel-yellow/40'
              }`}
              style={{ left: pct(sp.x), top: pct(sp.y), width: '19%', aspectRatio: '1' }}
            >
              <span className="text-[9px] font-semibold leading-tight text-center px-0.5">
                {sp.option}
              </span>
            </button>
          )
        })}

        {/* Which way round the field is. This is the whole reason the map
            exists: "Left" means nothing without knowing where you stand. */}
        <div className="absolute inset-x-0 bottom-0 h-4 bg-pastel-blue-dark/70 flex items-center justify-center">
          <span className="text-[9px] font-semibold text-white tracking-wide">
            YOUR DRIVER STATION
          </span>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mt-1">
        {multi
          ? (picked.length
              ? `Owned ${picked.length} of ${options.length}: ${picked.join(', ')}.`
              : 'Tap each flower they finished owning. None is a fine answer.')
          : (value
              ? `Starting ${value.toLowerCase()}, looking out from your driver station.`
              : 'Tap the square where the robot lines up.')}
      </p>
    </div>
  )
}
