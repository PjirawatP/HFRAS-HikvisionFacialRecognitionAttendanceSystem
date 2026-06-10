export interface DetectionData {
    id: number
    external_id: string
    first_name: string
    last_name: string
    position: string
    group: string
    is_blacklist: boolean
    face_image_path: string | null
    detect_image_path: string | null
    similarity: number | null
    detected_at: string | null
    camera_name: string
}