import { tripsApi } from '../api/client'
import { offlineDb, upsertTrip } from '../db/offlineDb'
import type { Trip } from '../types'

export const tripRepo = {
  async get(tripId: number | string): Promise<{ trip: Trip }> {
    if (!navigator.onLine) {
      const cached = await offlineDb.trips.get(Number(tripId))
      if (cached) return { trip: cached }
      throw new Error('No cached trip data available offline')
    }
    const result = await tripsApi.get(tripId)
    upsertTrip(result.trip)
    return result
  },
}
