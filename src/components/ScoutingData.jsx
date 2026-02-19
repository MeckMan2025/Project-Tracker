import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp, Trash2, Plus, X } from 'lucide-react'
import { supabase } from '../supabase'
import { useUser } from '../contexts/UserContext'
import { usePermissions } from '../hooks/usePermissions'
import NotificationBell from './NotificationBell'

// Default considered teams (used as fallback before Supabase loads)
const DEFAULT_CONSIDERED = ['6603', '20097', '22479']

// Pre-computed scouting stats per team (from imported match data — 356 total records)
const SCOUT_STATS = {
  '367':   { scouted: 6, autoPctClassified: 31, autoPctMissed: 13, autoPctOverflowed: 0, autoPctMotif: 56, autoAvgClassified: 0.8, autoAvgMissed: 0.3, autoAvgOverflowed: 0, autoAvgMotif: 1.5, telePctClassified: 42, telePctMissed: 24, telePctOverflowed: 0, telePctMotif: 33, teleAvgClassified: 2.3, teleAvgMissed: 1.3, teleAvgOverflowed: 0, teleAvgMotif: 1.8, teleAvgDepot: 0.8, leavePct: 83, fullParkPct: 17, partialParkPct: 83, noParkPct: 0, avgScore: 39.8 },
  '3738':  { scouted: 1, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 0, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 0, teleAvgClassified: 0, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0, teleAvgDepot: 0, leavePct: 0, fullParkPct: 100, partialParkPct: 0, noParkPct: 0, avgScore: 44 },
  '4177':  { scouted: 4, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 100, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0.3, telePctClassified: 11, telePctMissed: 11, telePctOverflowed: 0, telePctMotif: 78, teleAvgClassified: 0.3, teleAvgMissed: 0.3, teleAvgOverflowed: 0, teleAvgMotif: 1.8, teleAvgDepot: 0.5, leavePct: 75, fullParkPct: 50, partialParkPct: 50, noParkPct: 0, avgScore: 48 },
  '4771':  { scouted: 1, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 100, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 2, telePctClassified: 0, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 100, teleAvgClassified: 0, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 2, teleAvgDepot: 0, leavePct: 0, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 25 },
  '5062':  { scouted: 6, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 40, telePctMissed: 38, telePctOverflowed: 0, telePctMotif: 22, teleAvgClassified: 3, teleAvgMissed: 2.8, teleAvgOverflowed: 0, teleAvgMotif: 1.7, teleAvgDepot: 0.3, leavePct: 33, fullParkPct: 33, partialParkPct: 67, noParkPct: 0, avgScore: 42 },
  '5126':  { scouted: 1, autoPctClassified: 0, autoPctMissed: 100, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 1, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 0, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 0, teleAvgClassified: 0, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0, teleAvgDepot: 0, leavePct: 100, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 63 },
  '6062':  { scouted: 1, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 100, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 1, telePctClassified: 0, telePctMissed: 43, telePctOverflowed: 0, telePctMotif: 57, teleAvgClassified: 0, teleAvgMissed: 3, teleAvgOverflowed: 0, teleAvgMotif: 4, teleAvgDepot: 2, leavePct: 0, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 54 },
  '6072':  { scouted: 5, autoPctClassified: 50, autoPctMissed: 14, autoPctOverflowed: 0, autoPctMotif: 36, autoAvgClassified: 1.4, autoAvgMissed: 0.4, autoAvgOverflowed: 0, autoAvgMotif: 1, telePctClassified: 40, telePctMissed: 29, telePctOverflowed: 6, telePctMotif: 26, teleAvgClassified: 2.8, teleAvgMissed: 2, teleAvgOverflowed: 0.4, teleAvgMotif: 1.8, teleAvgDepot: 0.4, leavePct: 60, fullParkPct: 40, partialParkPct: 60, noParkPct: 0, avgScore: 61 },
  '6082':  { scouted: 1, autoPctClassified: 0, autoPctMissed: 75, autoPctOverflowed: 0, autoPctMotif: 25, autoAvgClassified: 0, autoAvgMissed: 3, autoAvgOverflowed: 0, autoAvgMotif: 1, telePctClassified: 21, telePctMissed: 14, telePctOverflowed: 0, telePctMotif: 64, teleAvgClassified: 3, teleAvgMissed: 2, teleAvgOverflowed: 0, teleAvgMotif: 9, teleAvgDepot: 0, leavePct: 100, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 99 },
  '6093':  { scouted: 27, autoPctClassified: 74, autoPctMissed: 11, autoPctOverflowed: 0, autoPctMotif: 15, autoAvgClassified: 2.2, autoAvgMissed: 0.3, autoAvgOverflowed: 0, autoAvgMotif: 0.4, telePctClassified: 70, telePctMissed: 13, telePctOverflowed: 1, telePctMotif: 16, teleAvgClassified: 9.3, teleAvgMissed: 1.7, teleAvgOverflowed: 0.1, teleAvgMotif: 2.1, teleAvgDepot: 3.7, leavePct: 96, fullParkPct: 52, partialParkPct: 37, noParkPct: 11, avgScore: 77.1 },
  '6458':  { scouted: 3, autoPctClassified: 60, autoPctMissed: 40, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 1, autoAvgMissed: 0.7, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 50, telePctMissed: 40, telePctOverflowed: 0, telePctMotif: 10, teleAvgClassified: 3.3, teleAvgMissed: 2.7, teleAvgOverflowed: 0, teleAvgMotif: 0.7, teleAvgDepot: 0, leavePct: 100, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 61.3 },
  '6545':  { scouted: 3, autoPctClassified: 100, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0.7, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 33, telePctMissed: 58, telePctOverflowed: 0, telePctMotif: 9, teleAvgClassified: 3.7, teleAvgMissed: 6.3, teleAvgOverflowed: 0, teleAvgMotif: 1, teleAvgDepot: 0, leavePct: 67, fullParkPct: 33, partialParkPct: 33, noParkPct: 33, avgScore: 38 },
  '6603':  { scouted: 9, autoPctClassified: 30, autoPctMissed: 70, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0.7, autoAvgMissed: 1.6, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 41, telePctMissed: 51, telePctOverflowed: 0, telePctMotif: 8, teleAvgClassified: 4.3, teleAvgMissed: 5.3, teleAvgOverflowed: 0, teleAvgMotif: 0.9, teleAvgDepot: 0.1, leavePct: 89, fullParkPct: 44, partialParkPct: 44, noParkPct: 11, avgScore: 73.6 },
  '6638':  { scouted: 1, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 100, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 0, teleAvgClassified: 5, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0, teleAvgDepot: 0, leavePct: 0, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 74 },
  '7196':  { scouted: 28, autoPctClassified: 77, autoPctMissed: 2, autoPctOverflowed: 1, autoPctMotif: 20, autoAvgClassified: 2.5, autoAvgMissed: 0.1, autoAvgOverflowed: 0, autoAvgMotif: 0.6, telePctClassified: 73, telePctMissed: 8, telePctOverflowed: 1, telePctMotif: 18, teleAvgClassified: 7.8, teleAvgMissed: 0.9, teleAvgOverflowed: 0.1, teleAvgMotif: 1.9, teleAvgDepot: 0.7, leavePct: 86, fullParkPct: 43, partialParkPct: 46, noParkPct: 11, avgScore: 73.9 },
  '7229':  { scouted: 3, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 85, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 15, teleAvgClassified: 7.3, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 1.3, teleAvgDepot: 0, leavePct: 0, fullParkPct: 33, partialParkPct: 67, noParkPct: 0, avgScore: 79.7 },
  '7258':  { scouted: 3, autoPctClassified: 100, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 1.3, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 84, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 16, teleAvgClassified: 5.3, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 1, teleAvgDepot: 0.3, leavePct: 67, fullParkPct: 100, partialParkPct: 0, noParkPct: 0, avgScore: 93 },
  '7332':  { scouted: 1, autoPctClassified: 100, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 1, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 20, telePctMissed: 20, telePctOverflowed: 0, telePctMotif: 60, teleAvgClassified: 1, teleAvgMissed: 1, teleAvgOverflowed: 0, teleAvgMotif: 3, teleAvgDepot: 0, leavePct: 100, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 50 },
  '7924':  { scouted: 1, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 88, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 13, teleAvgClassified: 7, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 1, teleAvgDepot: 0, leavePct: 100, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 84 },
  '8588':  { scouted: 15, autoPctClassified: 100, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0.1, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 57, telePctMissed: 7, telePctOverflowed: 0, telePctMotif: 35, teleAvgClassified: 4.2, teleAvgMissed: 0.5, teleAvgOverflowed: 0, teleAvgMotif: 2.6, teleAvgDepot: 0.5, leavePct: 27, fullParkPct: 53, partialParkPct: 47, noParkPct: 0, avgScore: 91.9 },
  '8672':  { scouted: 7, autoPctClassified: 85, autoPctMissed: 15, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 1.6, autoAvgMissed: 0.3, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 60, telePctMissed: 19, telePctOverflowed: 0, telePctMotif: 20, teleAvgClassified: 7.6, teleAvgMissed: 2.4, teleAvgOverflowed: 0, teleAvgMotif: 2.6, teleAvgDepot: 0.3, leavePct: 100, fullParkPct: 29, partialParkPct: 57, noParkPct: 14, avgScore: 61.9 },
  '8696':  { scouted: 4, autoPctClassified: 60, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 40, autoAvgClassified: 0.8, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0.5, telePctClassified: 46, telePctMissed: 18, telePctOverflowed: 13, telePctMotif: 23, teleAvgClassified: 4.5, teleAvgMissed: 1.8, teleAvgOverflowed: 1.3, teleAvgMotif: 2.3, teleAvgDepot: 0.3, leavePct: 100, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 58 },
  '8734':  { scouted: 1, autoPctClassified: 100, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 3, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 32, telePctMissed: 42, telePctOverflowed: 5, telePctMotif: 21, teleAvgClassified: 6, teleAvgMissed: 8, teleAvgOverflowed: 1, teleAvgMotif: 4, teleAvgDepot: 0, leavePct: 100, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 67 },
  '8743':  { scouted: 6, autoPctClassified: 67, autoPctMissed: 7, autoPctOverflowed: 0, autoPctMotif: 27, autoAvgClassified: 1.7, autoAvgMissed: 0.2, autoAvgOverflowed: 0, autoAvgMotif: 0.7, telePctClassified: 59, telePctMissed: 11, telePctOverflowed: 9, telePctMotif: 21, teleAvgClassified: 8.5, teleAvgMissed: 1.7, teleAvgOverflowed: 1.3, teleAvgMotif: 3, teleAvgDepot: 5.3, leavePct: 83, fullParkPct: 33, partialParkPct: 33, noParkPct: 33, avgScore: 75.8 },
  '8807':  { scouted: 2, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 100, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 0, teleAvgClassified: 1, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0, teleAvgDepot: 0, leavePct: 100, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 26.5 },
  '8813':  { scouted: 1, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 0, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 0, teleAvgClassified: 0, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0, teleAvgDepot: 0, leavePct: 100, fullParkPct: 100, partialParkPct: 0, noParkPct: 0, avgScore: 87 },
  '8988':  { scouted: 14, autoPctClassified: 50, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 50, autoAvgClassified: 0.1, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0.1, telePctClassified: 24, telePctMissed: 12, telePctOverflowed: 0, telePctMotif: 63, teleAvgClassified: 0.7, teleAvgMissed: 0.4, teleAvgOverflowed: 0, teleAvgMotif: 1.9, teleAvgDepot: 0.2, leavePct: 29, fullParkPct: 29, partialParkPct: 57, noParkPct: 14, avgScore: 53.4 },
  '9978':  { scouted: 4, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 92, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 8, teleAvgClassified: 2.8, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0.3, teleAvgDepot: 0.5, leavePct: 100, fullParkPct: 25, partialParkPct: 0, noParkPct: 75, avgScore: 63.3 },
  '10082': { scouted: 4, autoPctClassified: 50, autoPctMissed: 32, autoPctOverflowed: 0, autoPctMotif: 18, autoAvgClassified: 2.8, autoAvgMissed: 1.8, autoAvgOverflowed: 0, autoAvgMotif: 1, telePctClassified: 57, telePctMissed: 23, telePctOverflowed: 2, telePctMotif: 17, teleAvgClassified: 6.8, teleAvgMissed: 2.8, teleAvgOverflowed: 0.3, teleAvgMotif: 2, teleAvgDepot: 0.3, leavePct: 100, fullParkPct: 25, partialParkPct: 75, noParkPct: 0, avgScore: 72.3 },
  '10139': { scouted: 11, autoPctClassified: 100, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0.3, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 70, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 30, teleAvgClassified: 3.9, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 1.6, teleAvgDepot: 0.5, leavePct: 73, fullParkPct: 27, partialParkPct: 73, noParkPct: 0, avgScore: 78.5 },
  '10602': { scouted: 9, autoPctClassified: 40, autoPctMissed: 20, autoPctOverflowed: 0, autoPctMotif: 40, autoAvgClassified: 0.4, autoAvgMissed: 0.2, autoAvgOverflowed: 0, autoAvgMotif: 0.4, telePctClassified: 30, telePctMissed: 40, telePctOverflowed: 2, telePctMotif: 29, teleAvgClassified: 2.1, teleAvgMissed: 2.8, teleAvgOverflowed: 0.1, teleAvgMotif: 2, teleAvgDepot: 0.1, leavePct: 67, fullParkPct: 0, partialParkPct: 56, noParkPct: 44, avgScore: 48.1 },
  '11721': { scouted: 11, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 77, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 23, teleAvgClassified: 0.9, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0.3, teleAvgDepot: 0, leavePct: 18, fullParkPct: 18, partialParkPct: 73, noParkPct: 9, avgScore: 45.4 },
  '12745': { scouted: 4, autoPctClassified: 60, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 40, autoAvgClassified: 1.5, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 1, telePctClassified: 47, telePctMissed: 18, telePctOverflowed: 0, telePctMotif: 35, teleAvgClassified: 2, teleAvgMissed: 0.8, teleAvgOverflowed: 0, teleAvgMotif: 1.5, teleAvgDepot: 0, leavePct: 75, fullParkPct: 75, partialParkPct: 25, noParkPct: 0, avgScore: 50.3 },
  '13532': { scouted: 4, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 0, telePctMissed: 100, telePctOverflowed: 0, telePctMotif: 0, teleAvgClassified: 0, teleAvgMissed: 2, teleAvgOverflowed: 0, teleAvgMotif: 0, teleAvgDepot: 0, leavePct: 0, fullParkPct: 50, partialParkPct: 25, noParkPct: 25, avgScore: 52 },
  '14452': { scouted: 1, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 0, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 0, teleAvgClassified: 0, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0, teleAvgDepot: 0, leavePct: 0, fullParkPct: 100, partialParkPct: 0, noParkPct: 0, avgScore: 58 },
  '15050': { scouted: 11, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 0, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 0, teleAvgClassified: 0, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0, teleAvgDepot: 0.2, leavePct: 82, fullParkPct: 55, partialParkPct: 27, noParkPct: 18, avgScore: 34.1 },
  '15055': { scouted: 6, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 100, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0.3, telePctClassified: 52, telePctMissed: 26, telePctOverflowed: 0, telePctMotif: 22, teleAvgClassified: 2, teleAvgMissed: 1, teleAvgOverflowed: 0, teleAvgMotif: 0.8, teleAvgDepot: 0, leavePct: 67, fullParkPct: 50, partialParkPct: 33, noParkPct: 17, avgScore: 38.7 },
  '18482': { scouted: 2, autoPctClassified: 100, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0.5, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 0, telePctMissed: 100, telePctOverflowed: 0, telePctMotif: 0, teleAvgClassified: 0, teleAvgMissed: 0.5, teleAvgOverflowed: 0, teleAvgMotif: 0, teleAvgDepot: 0, leavePct: 100, fullParkPct: 0, partialParkPct: 50, noParkPct: 50, avgScore: 67.5 },
  '19394': { scouted: 3, autoPctClassified: 100, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 1.3, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 83, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 17, teleAvgClassified: 3.3, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0.7, teleAvgDepot: 0, leavePct: 100, fullParkPct: 33, partialParkPct: 67, noParkPct: 0, avgScore: 59 },
  '19978': { scouted: 4, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 73, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 27, teleAvgClassified: 8, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 3, teleAvgDepot: 15, leavePct: 0, fullParkPct: 75, partialParkPct: 25, noParkPct: 0, avgScore: 52.8 },
  '19984': { scouted: 1, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 0, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 0, teleAvgClassified: 0, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0, teleAvgDepot: 0, leavePct: 0, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 58 },
  '20097': { scouted: 17, autoPctClassified: 93, autoPctMissed: 7, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 2.5, autoAvgMissed: 0.2, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 75, telePctMissed: 4, telePctOverflowed: 0, telePctMotif: 21, teleAvgClassified: 9.8, teleAvgMissed: 0.5, teleAvgOverflowed: 0, teleAvgMotif: 2.7, teleAvgDepot: 2.4, leavePct: 100, fullParkPct: 47, partialParkPct: 41, noParkPct: 12, avgScore: 73.8 },
  '21892': { scouted: 2, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 87, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 13, teleAvgClassified: 6.5, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 1, teleAvgDepot: 0, leavePct: 100, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 60.5 },
  '21900': { scouted: 2, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 94, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 6, teleAvgClassified: 7.5, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0.5, teleAvgDepot: 0, leavePct: 0, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 49 },
  '21903': { scouted: 3, autoPctClassified: 100, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 1.3, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 71, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 29, teleAvgClassified: 7.3, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 3, teleAvgDepot: 0, leavePct: 100, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 63.3 },
  '22064': { scouted: 6, autoPctClassified: 33, autoPctMissed: 67, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0.2, autoAvgMissed: 0.3, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 45, telePctMissed: 39, telePctOverflowed: 0, telePctMotif: 16, teleAvgClassified: 2.3, teleAvgMissed: 2, teleAvgOverflowed: 0, teleAvgMotif: 0.8, teleAvgDepot: 0, leavePct: 67, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 28.7 },
  '22469': { scouted: 1, autoPctClassified: 100, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 3, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 80, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 20, teleAvgClassified: 8, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 2, teleAvgDepot: 8, leavePct: 100, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 86 },
  '22479': { scouted: 11, autoPctClassified: 96, autoPctMissed: 4, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 2, autoAvgMissed: 0.1, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 69, telePctMissed: 18, telePctOverflowed: 0, telePctMotif: 12, teleAvgClassified: 7.6, teleAvgMissed: 2, teleAvgOverflowed: 0, teleAvgMotif: 1.4, teleAvgDepot: 7.6, leavePct: 100, fullParkPct: 36, partialParkPct: 45, noParkPct: 18, avgScore: 66.2 },
  '23971': { scouted: 5, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 37, telePctMissed: 33, telePctOverflowed: 7, telePctMotif: 22, teleAvgClassified: 2, teleAvgMissed: 1.8, teleAvgOverflowed: 0.4, teleAvgMotif: 1.2, teleAvgDepot: 0.6, leavePct: 80, fullParkPct: 40, partialParkPct: 60, noParkPct: 0, avgScore: 35.8 },
  '24296': { scouted: 8, autoPctClassified: 44, autoPctMissed: 56, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0.5, autoAvgMissed: 0.6, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 24, telePctMissed: 67, telePctOverflowed: 0, telePctMotif: 9, teleAvgClassified: 1.4, teleAvgMissed: 3.8, teleAvgOverflowed: 0, teleAvgMotif: 0.5, teleAvgDepot: 0, leavePct: 50, fullParkPct: 50, partialParkPct: 25, noParkPct: 25, avgScore: 51.8 },
  '24586': { scouted: 3, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 86, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 14, teleAvgClassified: 6.3, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 1, teleAvgDepot: 0, leavePct: 100, fullParkPct: 33, partialParkPct: 67, noParkPct: 0, avgScore: 51 },
  '25656': { scouted: 13, autoPctClassified: 99, autoPctMissed: 1, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 6.7, autoAvgMissed: 0.1, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 85, telePctMissed: 1, telePctOverflowed: 0, telePctMotif: 13, teleAvgClassified: 17.6, teleAvgMissed: 0.2, teleAvgOverflowed: 0, teleAvgMotif: 2.8, teleAvgDepot: 2, leavePct: 100, fullParkPct: 23, partialParkPct: 69, noParkPct: 8, avgScore: 100.4 },
  '25788': { scouted: 9, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 100, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0.1, telePctClassified: 19, telePctMissed: 66, telePctOverflowed: 0, telePctMotif: 15, teleAvgClassified: 1.1, teleAvgMissed: 3.9, teleAvgOverflowed: 0, teleAvgMotif: 0.9, teleAvgDepot: 0.2, leavePct: 22, fullParkPct: 33, partialParkPct: 56, noParkPct: 11, avgScore: 35.9 },
  '26744': { scouted: 1, autoPctClassified: 17, autoPctMissed: 83, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 1, autoAvgMissed: 5, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 63, telePctMissed: 26, telePctOverflowed: 0, telePctMotif: 11, teleAvgClassified: 17, teleAvgMissed: 7, teleAvgOverflowed: 0, teleAvgMotif: 3, teleAvgDepot: 0, leavePct: 100, fullParkPct: 100, partialParkPct: 0, noParkPct: 0, avgScore: 120 },
  '31541': { scouted: 21, autoPctClassified: 38, autoPctMissed: 58, autoPctOverflowed: 0, autoPctMotif: 4, autoAvgClassified: 0.5, autoAvgMissed: 0.7, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 56, telePctMissed: 25, telePctOverflowed: 0, telePctMotif: 18, teleAvgClassified: 6, teleAvgMissed: 2.6, teleAvgOverflowed: 0, teleAvgMotif: 2, teleAvgDepot: 0.4, leavePct: 90, fullParkPct: 14, partialParkPct: 86, noParkPct: 0, avgScore: 73 },
  '32019': { scouted: 4, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 87, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 13, teleAvgClassified: 6.5, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 1, teleAvgDepot: 5, leavePct: 0, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 52.5 },
  '32494': { scouted: 13, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 24, telePctMissed: 57, telePctOverflowed: 0, telePctMotif: 19, teleAvgClassified: 0.4, teleAvgMissed: 0.9, teleAvgOverflowed: 0, teleAvgMotif: 0.3, teleAvgDepot: 0.4, leavePct: 62, fullParkPct: 38, partialParkPct: 38, noParkPct: 23, avgScore: 44 },
  '32978': { scouted: 2, autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0, autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0, telePctClassified: 81, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 19, teleAvgClassified: 8.5, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 2, teleAvgDepot: 8.5, leavePct: 0, fullParkPct: 0, partialParkPct: 100, noParkPct: 0, avgScore: 71.5 },
}

// All 34 competition teams with updated rankings
const ALL_TEAMS = [
  { rank: 1,  number: '25656', name: 'Pioneer Robotics',                   rp: 5.90, tbp: 166.10, autoAvg: 15.50, teleopAvg: 44.80, highScore: 198, record: '10-0-0', played: 30 },
  { rank: 2,  number: '6093',  name: 'Deviation From The Norm',            rp: 5.10, tbp: 109.90, autoAvg: 17.50, teleopAvg: 26.50, highScore: 198, record: '10-0-0', played: 30 },
  { rank: 3,  number: '7196',  name: "Everything That's Radical",          rp: 4.90, tbp: 84.30,  autoAvg: 14.00, teleopAvg: 23.70, highScore: 106, record: '10-0-0', played: 30 },
  { rank: 4,  number: '22479', name: 'Royal Robots',                       rp: 4.80, tbp: 100.20, autoAvg: 13.50, teleopAvg: 22.70, highScore: 190, record: '10-0-0', played: 24 },
  { rank: 5,  number: '8743',  name: 'Raw Bacon',                          rp: 4.80, tbp: 77.50,  autoAvg: 14.00, teleopAvg: 22.00, highScore: 147, record: '10-0-0', played: 30 },
  { rank: 6,  number: '10082', name: 'Mechanicats',                        rp: 4.70, tbp: 79.90,  autoAvg: 13.50, teleopAvg: 24.20, highScore: 154, record: '10-0-0', played: 30 },
  { rank: 7,  number: '6458',  name: 'Burgbots',                           rp: 4.60, tbp: 86.20,  autoAvg: 14.50, teleopAvg: 22.70, highScore: 163, record: '10-0-0', played: 24 },
  { rank: 8,  number: '24296', name: 'TopBot',                             rp: 4.60, tbp: 80.60,  autoAvg: 13.00, teleopAvg: 22.60, highScore: 154, record: '10-0-0', played: 30 },
  { rank: 9,  number: '31541', name: 'Davenport West',                     rp: 4.50, tbp: 83.10,  autoAvg: 13.00, teleopAvg: 20.20, highScore: 175, record: '10-0-0', played: 24 },
  { rank: 10, number: '22064', name: 'ThunderBots',                        rp: 4.40, tbp: 60.50,  autoAvg: 13.50, teleopAvg: 16.80, highScore: 118, record: '10-0-0', played: 30 },
  { rank: 11, number: '6072',  name: 'Wildbot Robotics',                   rp: 4.30, tbp: 72.20,  autoAvg: 15.00, teleopAvg: 21.10, highScore: 146, record: '10-0-0', played: 24 },
  { rank: 12, number: '15050', name: 'Lightning Bots',                     rp: 4.30, tbp: 64.00,  autoAvg: 14.00, teleopAvg: 15.00, highScore: 79,  record: '10-0-0', played: 30 },
  { rank: 13, number: '8672',  name: 'UBett',                              rp: 4.30, tbp: 61.00,  autoAvg: 13.50, teleopAvg: 12.30, highScore: 78,  record: '10-0-0', played: 30 },
  { rank: 14, number: '6603',  name: 'Guild of Gears',                     rp: 4.20, tbp: 78.80,  autoAvg: 13.50, teleopAvg: 17.10, highScore: 154, record: '10-0-0', played: 30 },
  { rank: 15, number: '8696',  name: 'Trobotix',                           rp: 4.20, tbp: 60.90,  autoAvg: 12.50, teleopAvg: 14.50, highScore: 82,  record: '10-0-0', played: 24 },
  { rank: 16, number: '20097', name: 'Robo Raptors',                       rp: 4.10, tbp: 81.60,  autoAvg: 14.00, teleopAvg: 15.00, highScore: 111, record: '10-0-0', played: 24 },
  { rank: 17, number: '8588',  name: 'Finger Puppet Mafia',                rp: 4.00, tbp: 67.50,  autoAvg: 15.50, teleopAvg: 12.20, highScore: 116, record: '8-2-0',  played: 18 },
  { rank: 18, number: '5062',  name: 'Mechanaries',                        rp: 4.00, tbp: 60.70,  autoAvg: 13.00, teleopAvg: 15.00, highScore: 78,  record: '10-0-0', played: 30 },
  { rank: 19, number: '6545',  name: 'Knight Riders',                      rp: 3.90, tbp: 67.40,  autoAvg: 11.00, teleopAvg: 17.50, highScore: 138, record: '10-0-0', played: 24 },
  { rank: 20, number: '10602', name: 'Pioneer Robotics',                   rp: 3.90, tbp: 61.80,  autoAvg: 10.50, teleopAvg: 13.50, highScore: 147, record: '10-0-0', played: 30 },
  { rank: 21, number: '15055', name: 'DeDucktive Thinkers',                rp: 3.90, tbp: 60.90,  autoAvg: 11.50, teleopAvg: 10.00, highScore: 118, record: '10-0-0', played: 30 },
  { rank: 22, number: '4237',  name: 'Cyberhawks',                         rp: 3.90, tbp: 53.40,  autoAvg: 10.00, teleopAvg: 12.10, highScore: 135, record: '10-0-0', played: 24 },
  { rank: 23, number: '4177',  name: 'Finger Tightans',                    rp: 3.90, tbp: 47.90,  autoAvg: 11.00, teleopAvg: 12.40, highScore: 148, record: '9-1-0',  played: 24 },
  { rank: 24, number: '12745', name: 'Long John Launchers',                rp: 3.80, tbp: 57.30,  autoAvg: 13.00, teleopAvg: 12.10, highScore: 79,  record: '10-0-0', played: 18 },
  { rank: 25, number: '23971', name: 'Trobotix JV',                        rp: 3.50, tbp: 36.40,  autoAvg: 10.00, teleopAvg: 10.10, highScore: 64,  record: '9-0-1',  played: 24 },
  { rank: 26, number: '10139', name: 'Glitch Mob',                         rp: 3.40, tbp: 69.60,  autoAvg: 13.50, teleopAvg: 15.00, highScore: 138, record: '7-3-0',  played: 18 },
  { rank: 27, number: '8988',  name: 'Bellevue Blockheads',                rp: 3.40, tbp: 62.50,  autoAvg: 11.00, teleopAvg: 12.30, highScore: 127, record: '9-1-0',  played: 24 },
  { rank: 28, number: '32494', name: 'Screw Ups-Washington Middle School', rp: 3.40, tbp: 51.30,  autoAvg: 11.00, teleopAvg: 10.70, highScore: 76,  record: '9-1-0',  played: 24 },
  { rank: 29, number: '367',   name: 'Organized Chaos',                    rp: 3.20, tbp: 49.20,  autoAvg: 13.00, teleopAvg: 12.30, highScore: 91,  record: '6-3-1',  played: 30 },
  { rank: 30, number: '18482', name: 'Mechanical Soup',                    rp: 3.00, tbp: 57.10,  autoAvg: 11.50, teleopAvg: 13.50, highScore: 142, record: '8-2-0',  played: 24 },
  { rank: 31, number: '13532', name: 'EagleBots FTC 13532',                rp: 2.60, tbp: 40.30,  autoAvg: 13.00, teleopAvg: 6.50,  highScore: 74,  record: '6-4-0',  played: 24 },
  { rank: 32, number: '11721', name: 'Central Processing Units',           rp: 2.40, tbp: 57.10,  autoAvg: 12.50, teleopAvg: 12.90, highScore: 120, record: '4-6-0',  played: 18 },
  { rank: 33, number: '25788', name: 'Byte Brawlers',                      rp: 2.30, tbp: 33.90,  autoAvg: 9.50,  teleopAvg: 8.00,  highScore: 54,  record: '5-5-0',  played: 24 },
  { rank: 34, number: '8813',  name: 'The Winter Soldiers',                rp: 0,    tbp: 0,      autoAvg: 0,     teleopAvg: 0,     highScore: 0,   record: '--',     played: 0  },
]

// Delete permission now handled by usePermissions hook (canDeleteScouting)

function pctBar(value) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 rounded-full bg-gray-200">
        <div
          className="h-2.5 rounded-full bg-pastel-pink transition-all"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right">{value}%</span>
    </div>
  )
}

function computeScoutingStats(matches) {
  const n = matches.length
  const safePct = (num, den) => den === 0 ? 0 : Math.round((num / den) * 100)
  const avg = (total) => n === 0 ? 0 : +(total / n).toFixed(1)

  if (n === 0) {
    return {
      scoutCount: 0,
      startingPositions: {},
      autoPctClassified: 0, autoPctMissed: 0, autoPctOverflowed: 0, autoPctMotif: 0,
      telePctClassified: 0, telePctMissed: 0, telePctOverflowed: 0, telePctMotif: 0,
      teleLeavePct: 0,
      autoAvgClassified: 0, autoAvgMissed: 0, autoAvgOverflowed: 0, autoAvgMotif: 0,
      teleAvgClassified: 0, teleAvgMissed: 0, teleAvgOverflowed: 0, teleAvgMotif: 0, teleAvgDepot: 0,
      fullParkPct: 0, partialParkPct: 0, noParkPct: 0,
      avgAllianceScore: 0,
    }
  }

  const startingPositions = {}
  matches.forEach(m => {
    const pos = m.startingPosition || 'Unknown'
    startingPositions[pos] = (startingPositions[pos] || 0) + 1
  })

  const autoClassified = matches.reduce((s, m) => s + (Number(m.autoClassified) || 0), 0)
  const autoMissed = matches.reduce((s, m) => s + (Number(m.autoArtifactsMissed) || 0), 0)
  const autoOverflowed = matches.reduce((s, m) => s + (Number(m.autoOverflowed) || 0), 0)
  const autoMotif = matches.reduce((s, m) => s + (Number(m.autoInMotifOrder) || 0), 0)
  const autoTotal = autoClassified + autoMissed + autoOverflowed + autoMotif

  const teleClassified = matches.reduce((s, m) => s + (Number(m.teleClassified) || 0), 0)
  const teleMissed = matches.reduce((s, m) => s + (Number(m.teleArtifactsMissed) || 0), 0)
  const teleOverflowed = matches.reduce((s, m) => s + (Number(m.teleOverflowed) || 0), 0)
  const teleMotif = matches.reduce((s, m) => s + (Number(m.teleInMotifOrder) || 0), 0)
  const teleDepot = matches.reduce((s, m) => s + (Number(m.teleArtifactsInDepot) || 0), 0)
  const teleTotal = teleClassified + teleMissed + teleOverflowed + teleMotif

  const leaveCount = matches.filter(m => m.teleDidLeave === true).length
  const fullPark = matches.filter(m => m.parkingStatus === 'full').length
  const partialPark = matches.filter(m => m.parkingStatus === 'partial').length
  const noPark = matches.filter(m => m.parkingStatus === 'none' || m.parkingStatus === '').length

  const totalScore = matches.reduce((s, m) => s + (Number(m.allianceScore) || 0), 0)

  return {
    scoutCount: n,
    startingPositions,
    autoPctClassified: safePct(autoClassified, autoTotal),
    autoPctMissed: safePct(autoMissed, autoTotal),
    autoPctOverflowed: safePct(autoOverflowed, autoTotal),
    autoPctMotif: safePct(autoMotif, autoTotal),
    telePctClassified: safePct(teleClassified, teleTotal),
    telePctMissed: safePct(teleMissed, teleTotal),
    telePctOverflowed: safePct(teleOverflowed, teleTotal),
    telePctMotif: safePct(teleMotif, teleTotal),
    teleLeavePct: safePct(leaveCount, n),
    autoAvgClassified: avg(autoClassified),
    autoAvgMissed: avg(autoMissed),
    autoAvgOverflowed: avg(autoOverflowed),
    autoAvgMotif: avg(autoMotif),
    teleAvgClassified: avg(teleClassified),
    teleAvgMissed: avg(teleMissed),
    teleAvgOverflowed: avg(teleOverflowed),
    teleAvgMotif: avg(teleMotif),
    teleAvgDepot: avg(teleDepot),
    fullParkPct: safePct(fullPark, n),
    partialParkPct: safePct(partialPark, n),
    noParkPct: safePct(noPark, n),
    avgAllianceScore: avg(totalScore),
  }
}

function ScoutingData() {
  const { username } = useUser()
  const { canDeleteScouting: canDelete, canViewScoutingData, isGuest, hasLeadTag, isCofounder } = usePermissions()
  const [records, setRecords] = useState([])
  const [expandedTeams, setExpandedTeams] = useState({})
  const [consideredList, setConsideredList] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', number: '', rank: '' })
  const [deleteMode, setDeleteMode] = useState(false)

  // Load from Supabase
  useEffect(() => {
    supabase
      .from('scouting_records')
      .select('*')
      .order('submitted_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Failed to load scouting records:', error.message)
        if (data) setRecords(data)
      })
      .catch(err => console.error('Exception loading scouting records:', err))
  }, [])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('scouting-data-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scouting_records' }, (payload) => {
        setRecords(prev => {
          if (prev.some(r => r.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'scouting_records' }, (payload) => {
        setRecords(prev => prev.filter(r => r.id !== payload.old.id))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // Load considered teams from Supabase
  useEffect(() => {
    supabase
      .from('considered_teams')
      .select('*')
      .then(({ data, error }) => {
        if (error) console.error('Failed to load considered teams:', error.message)
        if (data) setConsideredList(data)
      })
  }, [])

  // Realtime for considered teams
  useEffect(() => {
    const channel = supabase
      .channel('considered-teams-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'considered_teams' }, () => {
        supabase.from('considered_teams').select('*').then(({ data }) => {
          if (data) setConsideredList(data)
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const handleAddConsidered = async () => {
    try {
      const number = addForm.number.trim()
      const name = addForm.name.trim()
      const rank = addForm.rank ? parseInt(addForm.rank) : null
      if (!number || !name) return

      // If a rank is specified, shift existing teams at that rank and below
      if (rank) {
        const toShift = consideredList.filter(c => c.rank && c.rank >= rank)
        for (const c of toShift) {
          await supabase.from('considered_teams').update({ rank: c.rank + 1 }).eq('team_number', c.team_number)
        }
      }

      const { data: insertData, error } = await supabase.from('considered_teams').insert({
        team_number: number,
        team_name: name,
        rank: rank,
        added_by: username
      }).select()
      if (error) {
        alert('Failed to add team: ' + error.message)
        return
      }
      // Refetch to get updated ranks
      const { data } = await supabase.from('considered_teams').select('*')
      if (data) setConsideredList(data)
      setAddForm({ name: '', number: '', rank: '' })
      setShowAddModal(false)
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleRemoveConsidered = async (teamNumber) => {
    const { error } = await supabase.from('considered_teams').delete().eq('team_number', teamNumber)
    if (error) console.error('Failed to remove considered team:', error.message)
    else setConsideredList(prev => prev.filter(c => c.team_number !== teamNumber))
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('scouting_records').delete().eq('id', id)
    if (error) {
      console.error('Failed to delete:', error.message)
      return
    }
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  const consideredNumbers = consideredList.map(c => c.team_number)

  // Merge competition data with scouting submissions, split into considered vs rest
  const { consideredTeams, otherTeams } = useMemo(() => {
    // Group scouting records by team number
    const byNumber = {}
    records.forEach(r => {
      const d = r.data || {}
      const num = String(d.teamNumber || '').trim()
      if (!num) return
      if (!byNumber[num]) byNumber[num] = []
      byNumber[num].push({ ...d, _id: r.id, _by: r.submitted_by, _at: r.submitted_at })
    })

    // Build team list from ALL_TEAMS, attach scouting data
    // Use hardcoded SCOUT_STATS as base, override with dynamic data if available
    const knownNumbers = new Set(ALL_TEAMS.map(t => t.number))
    const all = ALL_TEAMS.map(t => {
      const matches = byNumber[t.number] || []
      delete byNumber[t.number]
      const dynamicStats = computeScoutingStats(matches)
      const hardcodedStats = SCOUT_STATS[t.number]
      const stats = dynamicStats.scoutCount > 0 ? dynamicStats : (hardcodedStats ? { ...hardcodedStats, scoutCount: hardcodedStats.scouted, startingPositions: {} } : dynamicStats)
      return { ...t, matches, ...stats }
    })

    // Add custom teams (not in ALL_TEAMS) from considered list
    consideredList.forEach(c => {
      if (!knownNumbers.has(c.team_number)) {
        const matches = byNumber[c.team_number] || []
        delete byNumber[c.team_number]
        const stats = computeScoutingStats(matches)
        all.push({
          number: c.team_number,
          name: c.team_name || `Team ${c.team_number}`,
          rank: c.rank || null,
          record: '-',
          played: 0,
          rp: '-',
          tbp: '-',
          autoAvg: '-',
          teleopAvg: '-',
          highScore: '-',
          matches,
          ...stats,
        })
      }
    })

    // Apply rank overrides from considered_teams
    const rankOverrides = {}
    consideredList.forEach(c => { if (c.rank) rankOverrides[c.team_number] = c.rank })

    const considered = all
      .filter(t => consideredNumbers.includes(t.number))
      .map(t => rankOverrides[t.number] ? { ...t, rank: rankOverrides[t.number] } : t)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    const others = all.filter(t => !consideredNumbers.includes(t.number))
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))

    return { consideredTeams: considered, otherTeams: others }
  }, [records, consideredList, consideredNumbers])

  const toggleExpand = (key) => {
    setExpandedTeams(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <>
    {/* Add Team Modal — rendered outside scroll container */}
    {showAddModal && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => { setShowAddModal(false); setAddForm({ name: '', number: '', rank: '' }) }}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-gray-800 mb-4">Add Team to Considered</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Team Name</label>
              <input
                type="text"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pastel-pink"
                placeholder="e.g. Pioneer Robotics"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Team Number</label>
              <input
                type="text"
                value={addForm.number}
                onChange={e => setAddForm(f => ({ ...f, number: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pastel-pink"
                placeholder="e.g. 25656"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Rank <span className="text-gray-400">(optional)</span></label>
              <input
                type="number"
                min="1"
                value={addForm.rank}
                onChange={e => setAddForm(f => ({ ...f, rank: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pastel-pink"
                placeholder="e.g. 5"
              />
              <p className="text-[10px] text-gray-400 mt-1">If this rank is taken, existing teams will shift down</p>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => { setShowAddModal(false); setAddForm({ name: '', number: '', rank: '' }) }}
              className="flex-1 px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                alert('Name: "' + addForm.name + '", Number: "' + addForm.number + '", Rank: "' + addForm.rank + '"')
                handleAddConsidered()
              }}
              disabled={!addForm.name.trim() || !addForm.number.trim()}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-pastel-pink-dark hover:bg-pastel-pink rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add Team
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="flex-1 flex flex-col min-w-0">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="px-4 py-4 ml-10 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-pastel-blue-dark via-pastel-pink-dark to-pastel-orange-dark bg-clip-text text-transparent">
              Scouting Data
            </h1>
            <p className="text-sm text-gray-500">
              {ALL_TEAMS.length} teams &middot; {records.length} scouting response{records.length !== 1 ? 's' : ''}
            </p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 p-4 pl-14 md:pl-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-5 pb-8">

          {/* Teams Being Considered */}
          <div className="border-b-2 border-pastel-pink pb-2 mb-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Teams Being Considered</h2>
                <p className="text-xs text-gray-500">Alliance partner candidates</p>
              </div>
              <div className="flex items-center gap-2">
                {hasLeadTag && (
                  <button
                    onClick={() => setDeleteMode(!deleteMode)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${deleteMode ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {deleteMode ? 'Done' : 'Delete Mode'}
                  </button>
                )}
                {hasLeadTag && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-pastel-pink/40 hover:bg-pastel-pink transition-colors text-gray-700"
                    title="Add team to considered"
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {consideredTeams.map(t => (
            <div
              key={t.number}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* Team Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-pastel-blue/30 to-pastel-pink/30 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">
                        {t.name} <span className="text-gray-500 font-medium">#{t.number}</span>
                      </h2>
                      {t.rank && (
                        <span className="text-sm text-gray-500">Rank {t.rank}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {deleteMode && hasLeadTag && (
                      <button
                        onClick={() => handleRemoveConsidered(t.number)}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-500 hover:text-red-700 transition-colors"
                        title="Remove team"
                      >
                        <X size={16} />
                      </button>
                    )}
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-700">{t.record}</span>
                      <p className="text-xs text-gray-400">{t.played} matches</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Competition Stats */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">Competition Stats</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.rp}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">RP/Match</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.tbp}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">TBP/Match</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.autoAvg}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Auto Avg</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.teleopAvg}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Teleop Avg</p>
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <span className="text-xs text-gray-500">High Score: <span className="font-semibold text-gray-700">{t.highScore}</span></span>
                  </div>
                </div>

                {/* Scouting Data Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">
                    Our Scouting Data <span className="font-normal text-gray-400">({t.scoutCount} response{t.scoutCount !== 1 ? 's' : ''})</span>
                  </h3>

                  {t.scoutCount > 0 && (
                    <>
                      {/* Key Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-gray-50 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-gray-800">{t.avgAllianceScore}</p>
                          <p className="text-[10px] text-gray-500 uppercase">Avg Score</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-gray-800">{t.teleLeavePct}%</p>
                          <p className="text-[10px] text-gray-500 uppercase">Leave Rate</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-gray-800">{t.fullParkPct}%</p>
                          <p className="text-[10px] text-gray-500 uppercase">Full Park</p>
                        </div>
                      </div>

                      {/* Park Breakdown */}
                      <div className="mb-3">
                        <h4 className="text-xs font-medium text-gray-600 mb-1">Park Rate</h4>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-16">Full</span>
                            {pctBar(t.fullParkPct)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-16">Partial</span>
                            {pctBar(t.partialParkPct)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-16">No Park</span>
                            {pctBar(t.noParkPct)}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Starting Position */}
                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-gray-600 mb-1">Starting Position</h4>
                    {Object.keys(t.startingPositions).length === 0 ? (
                      <p className="text-xs text-gray-400">No data</p>
                    ) : (
                      <div className="space-y-1">
                        {Object.entries(t.startingPositions).map(([pos, count]) => (
                          <div key={pos} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-28 truncate">{pos}</span>
                            <div className="flex-1 h-2 rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-pastel-blue transition-all"
                                style={{ width: `${Math.round((count / t.scoutCount) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700 w-10 text-right">
                              {Math.round((count / t.scoutCount) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Autonomous */}
                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-gray-600 mb-1">Autonomous (avg per match)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.autoAvgClassified}</p>
                        <p className="text-[10px] text-gray-500">Classified</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.autoAvgMissed}</p>
                        <p className="text-[10px] text-gray-500">Missed</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.autoAvgOverflowed}</p>
                        <p className="text-[10px] text-gray-500">Overflowed</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.autoAvgMotif}</p>
                        <p className="text-[10px] text-gray-500">Motif Order</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div><span className="text-xs text-gray-500">Classified %</span>{pctBar(t.autoPctClassified)}</div>
                      <div><span className="text-xs text-gray-500">Missed %</span>{pctBar(t.autoPctMissed)}</div>
                      <div><span className="text-xs text-gray-500">Overflowed %</span>{pctBar(t.autoPctOverflowed)}</div>
                      <div><span className="text-xs text-gray-500">Motif Order %</span>{pctBar(t.autoPctMotif)}</div>
                    </div>
                  </div>

                  {/* Tele-Op */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-600 mb-1">Tele-Op (avg per match)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.teleAvgClassified}</p>
                        <p className="text-[10px] text-gray-500">Classified</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.teleAvgMissed}</p>
                        <p className="text-[10px] text-gray-500">Missed</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.teleAvgOverflowed}</p>
                        <p className="text-[10px] text-gray-500">Overflowed</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.teleAvgMotif}</p>
                        <p className="text-[10px] text-gray-500">Motif Order</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-gray-800">{t.teleAvgDepot}</p>
                        <p className="text-[10px] text-gray-500">Depot</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div><span className="text-xs text-gray-500">Classified %</span>{pctBar(t.telePctClassified)}</div>
                      <div><span className="text-xs text-gray-500">Missed %</span>{pctBar(t.telePctMissed)}</div>
                      <div><span className="text-xs text-gray-500">Overflowed %</span>{pctBar(t.telePctOverflowed)}</div>
                      <div><span className="text-xs text-gray-500">Motif Order %</span>{pctBar(t.telePctMotif)}</div>
                      <div><span className="text-xs text-gray-500">Leave Rate</span>{pctBar(t.teleLeavePct)}</div>
                    </div>
                  </div>
                </div>

                {/* Responses Toggle */}
                <button
                  onClick={() => toggleExpand(t.number)}
                  className="flex items-center gap-1.5 text-xs font-medium text-pastel-pink-dark hover:text-gray-700 transition-colors px-3 py-1.5 bg-gray-50 rounded-lg"
                >
                  {expandedTeams[t.number] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expandedTeams[t.number] ? 'Hide' : 'View'} Scouting Responses ({t.scoutCount})
                </button>

                {expandedTeams[t.number] && (
                  <div className="space-y-2">
                    {t.matches.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No scouting responses yet.</p>
                    ) : (
                      t.matches.map((m, i) => (
                        <div key={m._id || i} className="bg-gray-50 rounded-lg p-3 text-xs space-y-1 border border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-700">
                              Match {m.matchNumber || '?'} &middot; {m.allianceColor || '?'} Alliance
                            </span>
                            {canDelete && m._id && (
                              <button
                                onClick={() => handleDelete(m._id)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="Delete response"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <div className="text-gray-500">
                            Start: {m.startingPosition || '?'} | Stability: {
                              m.robotStability === 'no' ? 'No issues' :
                              m.robotStability === 'major' ? 'Major breakdown' :
                              m.robotStability === 'shutdown' ? 'Shutdown' : '?'
                            }
                          </div>
                          <div className="text-gray-500">
                            Auto: {m.autoClassified || 0} classified, {m.autoArtifactsMissed || 0} missed, {m.autoOverflowed || 0} overflow, {m.autoInMotifOrder || 0} motif
                          </div>
                          <div className="text-gray-500">
                            Tele: {m.teleClassified || 0} classified, {m.teleArtifactsMissed || 0} missed, {m.teleOverflowed || 0} overflow, {m.teleInMotifOrder || 0} motif
                          </div>
                          {(m.roles || []).length > 0 && (
                            <div className="text-gray-500">Roles: {m.roles.join(', ')}</div>
                          )}
                          {m.observations && (
                            <div className="text-gray-400 italic">"{m.observations}"</div>
                          )}
                          {m._by && (
                            <div className="text-gray-400 pt-0.5">Submitted by {m._by}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* All Teams by Rank */}
          <div className="border-b-2 border-pastel-blue pb-2 mb-1 mt-8">
            <h2 className="text-lg font-bold text-gray-800">All Teams by Rank</h2>
            <p className="text-xs text-gray-500">Ordered by competition ranking</p>
          </div>

          {otherTeams.map(t => (
            <div
              key={t.number}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* Team Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      {t.name} <span className="text-gray-500 font-medium">#{t.number}</span>
                    </h2>
                    {t.rank && (
                      <span className="text-sm text-gray-500">Rank {t.rank}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-700">{t.record}</span>
                    <p className="text-xs text-gray-400">{t.played} matches</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Competition Stats */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">Competition Stats</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.rp}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">RP/Match</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.tbp}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">TBP/Match</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.autoAvg}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Auto Avg</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-800">{t.teleopAvg}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Teleop Avg</p>
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <span className="text-xs text-gray-500">High Score: <span className="font-semibold text-gray-700">{t.highScore}</span></span>
                  </div>
                </div>

                {/* Scouting Data Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">
                    Our Scouting Data <span className="font-normal text-gray-400">({t.scoutCount} response{t.scoutCount !== 1 ? 's' : ''})</span>
                  </h3>

                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-gray-600 mb-1">Starting Position</h4>
                    {Object.keys(t.startingPositions).length === 0 ? (
                      <p className="text-xs text-gray-400">No data</p>
                    ) : (
                      <div className="space-y-1">
                        {Object.entries(t.startingPositions).map(([pos, count]) => (
                          <div key={pos} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-28 truncate">{pos}</span>
                            <div className="flex-1 h-2 rounded-full bg-gray-200">
                              <div className="h-2 rounded-full bg-pastel-blue transition-all" style={{ width: `${Math.round((count / t.scoutCount) * 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium text-gray-700 w-10 text-right">{Math.round((count / t.scoutCount) * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <h4 className="text-xs font-medium text-gray-600 mb-1">Autonomous</h4>
                    <div className="space-y-1.5">
                      <div><span className="text-xs text-gray-500">Classified</span>{pctBar(t.autoPctClassified)}</div>
                      <div><span className="text-xs text-gray-500">Missed</span>{pctBar(t.autoPctMissed)}</div>
                      <div><span className="text-xs text-gray-500">Overflowed</span>{pctBar(t.autoPctOverflowed)}</div>
                      <div><span className="text-xs text-gray-500">In Motif Order</span>{pctBar(t.autoPctMotif)}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-600 mb-1">Tele-Op</h4>
                    <div className="space-y-1.5">
                      <div><span className="text-xs text-gray-500">Classified</span>{pctBar(t.telePctClassified)}</div>
                      <div><span className="text-xs text-gray-500">Missed</span>{pctBar(t.telePctMissed)}</div>
                      <div><span className="text-xs text-gray-500">Overflowed</span>{pctBar(t.telePctOverflowed)}</div>
                      <div><span className="text-xs text-gray-500">In Motif Order</span>{pctBar(t.telePctMotif)}</div>
                      <div><span className="text-xs text-gray-500">Leave Rate</span>{pctBar(t.teleLeavePct)}</div>
                    </div>
                  </div>
                </div>

                {/* Responses Toggle */}
                <button
                  onClick={() => toggleExpand(t.number)}
                  className="flex items-center gap-1.5 text-xs font-medium text-pastel-pink-dark hover:text-gray-700 transition-colors px-3 py-1.5 bg-gray-50 rounded-lg"
                >
                  {expandedTeams[t.number] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expandedTeams[t.number] ? 'Hide' : 'View'} Scouting Responses ({t.scoutCount})
                </button>

                {expandedTeams[t.number] && (
                  <div className="space-y-2">
                    {t.matches.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No scouting responses yet.</p>
                    ) : (
                      t.matches.map((m, i) => (
                        <div key={m._id || i} className="bg-gray-50 rounded-lg p-3 text-xs space-y-1 border border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-700">
                              Match {m.matchNumber || '?'} &middot; {m.allianceColor || '?'} Alliance
                            </span>
                            {canDelete && m._id && (
                              <button
                                onClick={() => handleDelete(m._id)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="Delete response"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <div className="text-gray-500">
                            Start: {m.startingPosition || '?'} | Stability: {
                              m.robotStability === 'no' ? 'No issues' :
                              m.robotStability === 'major' ? 'Major breakdown' :
                              m.robotStability === 'shutdown' ? 'Shutdown' : '?'
                            }
                          </div>
                          <div className="text-gray-500">
                            Auto: {m.autoClassified || 0} classified, {m.autoArtifactsMissed || 0} missed, {m.autoOverflowed || 0} overflow, {m.autoInMotifOrder || 0} motif
                          </div>
                          <div className="text-gray-500">
                            Tele: {m.teleClassified || 0} classified, {m.teleArtifactsMissed || 0} missed, {m.teleOverflowed || 0} overflow, {m.teleInMotifOrder || 0} motif
                          </div>
                          {(m.roles || []).length > 0 && (
                            <div className="text-gray-500">Roles: {m.roles.join(', ')}</div>
                          )}
                          {m.observations && (
                            <div className="text-gray-400 italic">"{m.observations}"</div>
                          )}
                          {m._by && (
                            <div className="text-gray-400 pt-0.5">Submitted by {m._by}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
    </>
  )
}

export default ScoutingData
