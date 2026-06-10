import cv2, numpy as np, os, uuid, stat

from datetime import datetime



UPLOAD_DIR  = "files/images/faces/uploads"
CAPTURE_DIR = "files/images/faces/captures"



async def save_upload_face_image(
    image_bytes: bytes,
    filename: str,
    user_id: int,
) -> str:

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
    image_extension = os.path.splitext(filename)[1].lower()

    if image_extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file type")

    # ลบไฟล์เก่า — จัดการ Permission denied อย่างปลอดภัย
    import glob
    old_files = glob.glob(os.path.join(UPLOAD_DIR, f"user_{user_id}.*"))
    for old_file in old_files:
        try:
            # ถ้าไฟล์เป็น read-only ให้เพิ่ม write permission ก่อนลบ
            if not os.access(old_file, os.W_OK):
                os.chmod(old_file, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
            os.remove(old_file)
        except PermissionError as e:
            # ถ้ายังลบไม่ได้ (เช่น owned by root) ให้ข้ามไป
            # ไม่ควร crash — ไฟล์ใหม่จะ overwrite หรือใช้ชื่อใหม่แทน
            import logging
            logging.getLogger(__name__).warning(
                "Cannot delete old face image %s: %s", old_file, e
            )
        except FileNotFoundError:
            pass   # ถูกลบไปแล้ว ไม่ต้องทำอะไร

    image_name = f"user_{user_id}{image_extension}"
    image_path = os.path.join(UPLOAD_DIR, image_name)

    try:
        with open(image_path, "wb") as img:
            img.write(image_bytes)

        # ตั้ง permission ให้ไฟล์ที่บันทึกใหม่สามารถลบได้ในครั้งถัดไป
        os.chmod(image_path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)

    except Exception:
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
            except Exception:
                pass
        raise

    return image_path


def save_capture_face_image(image_bgr: np.ndarray) -> str:
    date   = datetime.now().strftime("%Y%m%d")
    folder = os.path.join(CAPTURE_DIR, date)
    os.makedirs(folder, exist_ok=True)

    filename   = f"{uuid.uuid4().hex}.jpg"
    image_path = os.path.join(folder, filename)

    cv2.imwrite(image_path, image_bgr)

    return image_path