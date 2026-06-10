"use client"



import { useCallback, useEffect, useRef, useState } from "react"



interface SummaryStats {
    total_cameras: number
    online_cameras: number
    offline_cameras: number
    total_persons: number
    blacklist_persons: number
    total_detections_today: number
    average_detections_per_day: number
}

interface CameraStatus {
    id: number
    name: string
    location: string | null
    status: string  // "online" | "offline"
    detections_today: number
    uptime_percentage: number
}

interface DetectionSummary {
    camera_name: string
    normal_count: number
    blacklist_count: number
}

interface HourlyTrend {
    hour: string
    count: number
}

interface DetectionStats {
    normal: number
    blacklist: number
}

interface SystemAlert {
    id: number
    type: string  // "warning" | "error" | "success"
    title: string
    location: string
    time: string
}

interface RecentDetection {
    id: number
    person_name: string
    camera_name: string
    detected_at: string
    similarity: number
    is_blacklist: boolean
    detect_image_path: string | null
}



// _____ Helper Functions __________________
const isDataEqual = (prev: any, next: any): boolean => {
    return JSON.stringify(prev) === JSON.stringify(next)
}



// _____ API Functions ____________________
const apiClient = {
    getSummaryStats: async (): Promise<SummaryStats> => {
        const response = await fetch(`/api/overview/summary`);
        if (!response.ok) throw new Error('Failed to fetch summary stats');
        return response.json();
    },

    getCameraStatus: async (): Promise<CameraStatus[]> => {
        const response = await fetch(`/api/overview/camera-status`);
        if (!response.ok) throw new Error('Failed to fetch camera status');
        return response.json();
    },

    getDetectionSummary: async (period: string = 'today'): Promise<DetectionSummary[]> => {
        const response = await fetch(`/api/overview/detection-summary-by-camera?period=${period}`);
        if (!response.ok) throw new Error('Failed to fetch detection summary');
        return response.json();
    },

    getHourlyTrend: async (): Promise<HourlyTrend[]> => {
        const response = await fetch(`/api/overview/hourly-trend`);
        if (!response.ok) throw new Error('Failed to fetch hourly trend');
        return response.json();
    },

    getDetectionStats: async (period: string = 'today'): Promise<DetectionStats> => {
        const response = await fetch(`/api/overview/detection-stats?period=${period}`);
        if (!response.ok) throw new Error('Failed to fetch detection stats');
        return response.json();
    },

    getSystemAlerts: async (limit: number = 10): Promise<SystemAlert[]> => {
        const response = await fetch(`/api/overview/system-alerts?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch system alerts');
        return response.json();
    },

    getRecentDetections: async (limit: number = 10): Promise<RecentDetection[]> => {
        const response = await fetch(`/api/overview/recent-detections?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch recent detections');
        return response.json();
    }
}



// _____ Custom Hooks _____________________
export function useSummaryStats() {
    const [data, setData] = useState<SummaryStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const isMountedRef = useRef(true)

    const fetchData = useCallback(async () => {
        try {
            const result = await apiClient.getSummaryStats()
            if (isMountedRef.current) {
                setData(prev => isDataEqual(prev, result) ? prev : result)
                setError(null)
            }
        } catch (err) {
            if (isMountedRef.current) setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            if (isMountedRef.current && loading) setLoading(false)
        }
    }, [loading])

    useEffect(() => {
        isMountedRef.current = true
        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => { isMountedRef.current = false; clearInterval(interval) }
    }, [fetchData])

    return { data, loading, error }
}



export function useCameraStatus() {
    const [data, setData] = useState<CameraStatus[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const isMountedRef = useRef(true)

    const fetchData = useCallback(async () => {
        try {
            const result = await apiClient.getCameraStatus()
            if (isMountedRef.current) {
                setData(prev => isDataEqual(prev, result) ? prev : result)
                setError(null)
            }
        } catch (err) {
            if (isMountedRef.current) setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            if (isMountedRef.current && loading) setLoading(false)
        }
    }, [loading])

    useEffect(() => {
        isMountedRef.current = true
        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => { isMountedRef.current = false; clearInterval(interval) }
    }, [fetchData])

    return { data, loading, error }
}



export function useDetectionSummary(period: string = 'today') {
    const [data, setData] = useState<DetectionSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const isMountedRef = useRef(true)

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const result = await apiClient.getDetectionSummary(period)
            if (isMountedRef.current) { setData(result); setError(null) }
        } catch (err) {
            if (isMountedRef.current) setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            if (isMountedRef.current) setLoading(false)
        }
    }, [period])

    useEffect(() => {
        isMountedRef.current = true
        fetchData()
        return () => { isMountedRef.current = false }
    }, [fetchData])

    return { data, loading, error, refetch: fetchData }
}



export function useHourlyTrend() {
    const [data, setData] = useState<HourlyTrend[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const isMountedRef = useRef(true)

    const fetchData = useCallback(async () => {
        try {
            const result = await apiClient.getHourlyTrend()
            if (isMountedRef.current) {
                setData(prev => isDataEqual(prev, result) ? prev : result)
                setError(null)
            }
        } catch (err) {
            if (isMountedRef.current) setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            if (isMountedRef.current && loading) setLoading(false)
        }
    }, [loading])

    useEffect(() => {
        isMountedRef.current = true
        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => { isMountedRef.current = false; clearInterval(interval) }
    }, [fetchData])

    return { data, loading, error }
}



export function useDetectionStats(period: string = 'today') {
    const [data, setData] = useState<DetectionStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const isMountedRef = useRef(true)

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const result = await apiClient.getDetectionStats(period)
            if (isMountedRef.current) { setData(result); setError(null) }
        } catch (err) {
            if (isMountedRef.current) setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            if (isMountedRef.current) setLoading(false)
        }
    }, [period])

    useEffect(() => {
        isMountedRef.current = true
        fetchData()
        return () => { isMountedRef.current = false }
    }, [fetchData])

    return { data, loading, error }
}



export function useSystemAlerts(limit: number = 10) {
    const [data, setData] = useState<SystemAlert[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const isMountedRef = useRef(true)
    const limitRef = useRef(limit)

    const fetchData = useCallback(async () => {
        try {
            const result = await apiClient.getSystemAlerts(limitRef.current)
            if (isMountedRef.current) {
                setData(prev => isDataEqual(prev, result) ? prev : result)
                setError(null)
            }
        } catch (err) {
            if (isMountedRef.current) setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            if (isMountedRef.current && loading) setLoading(false)
        }
    }, [loading])

    useEffect(() => { limitRef.current = limit }, [limit])

    useEffect(() => {
        isMountedRef.current = true
        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => { isMountedRef.current = false; clearInterval(interval) }
    }, [fetchData])

    return { data, loading, error }
}



export function useRecentDetections(limit: number = 10) {
    const [data, setData] = useState<RecentDetection[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const isMountedRef = useRef(true)
    const limitRef = useRef(limit)

    const fetchData = useCallback(async () => {
        try {
            const result = await apiClient.getRecentDetections(limitRef.current)
            if (isMountedRef.current) {
                setData(prev => isDataEqual(prev, result) ? prev : result)
                setError(null)
            }
        } catch (err) {
            if (isMountedRef.current) setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            if (isMountedRef.current && loading) setLoading(false)
        }
    }, [loading])

    useEffect(() => { limitRef.current = limit }, [limit])

    useEffect(() => {
        isMountedRef.current = true
        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => { isMountedRef.current = false; clearInterval(interval) }
    }, [fetchData])

    return { data, loading, error }
}