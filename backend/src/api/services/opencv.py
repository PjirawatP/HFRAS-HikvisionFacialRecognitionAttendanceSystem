import cv2



def check_rtsp(rtsp_url: str, timeout_sec: int = 5, retries: int = 3) -> bool:
    for attempt in range(retries):
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, timeout_sec * 1000)
        cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, timeout_sec * 1000)

        if cap.isOpened():
            ret, frame = cap.read()
            cap.release()
            if ret and frame is not None:
                return True
        else:
            cap.release()

    return False