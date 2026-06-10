import requests, time

from datetime import datetime
from sqlmodel import Session, select
from threading import Lock
from typing import Dict, Optional, List

from src.api.configs.database import engine
from src.api.models.notification_channel import NotificationChannelModel



class NotificationService:
    def __init__(self, cooldown_seconds: int = 30):
        self.cooldown_seconds = cooldown_seconds
        self.last_notification_time: Dict[str, float] = {}
        self.lock = Lock()
    

    def _can_send_notification(self, key: str) -> bool:
        with self.lock:
            now = time.time()
            last_time = self.last_notification_time.get(key, 0)
            
            if now - last_time >= self.cooldown_seconds:
                self.last_notification_time[key] = now
                return True
            return False
    

    def _get_active_channels(self) -> List[NotificationChannelModel]:
        try:
            with Session(engine) as session:
                channels = session.exec(
                    select(NotificationChannelModel).where(NotificationChannelModel.is_active == True)
                ).all()
                return list(channels)
        except Exception as e:
            print(f"Error getting channels: {e}")
            return []
    

    def _send_line_push(
        self,
        channel_token: str,
        target_id: str,
        message: str,
        image_path: Optional[str] = None
    ):
        try:
            url = "https://api.line.me/v2/bot/message/push"
            headers = {
                "Authorization": f"Bearer {channel_token}",
                "Content-Type": "application/json"
            }

            messages = [
                {
                    "type": "text",
                    "text": message
                }
            ]

            payload = {
                "to": target_id,
                "messages": messages
            }

            response = requests.post(url, headers=headers, json=payload, timeout=5)

            if response.status_code == 200:
                print("✓ LINE push message sent")
                return True
            else:
                print(f"✗ LINE push failed: {response.status_code} {response.text}")
                return False

        except Exception as e:
            print(f"✗ LINE push error: {e}")
            return False
    

    def _send_discord_webhook(self, webhook_url: str, message: str, image_path: Optional[str] = None):
        """ส่งการแจ้งเตือนผ่าน Discord Webhook"""
        try:
            data = {"content": message}
            files = None
            
            if image_path:
                try:
                    files = {"file": open(image_path, "rb")}
                except:
                    pass
            
            response = requests.post(webhook_url, data=data, files=files, timeout=5)
            
            if files:
                files["file"].close()
            
            if response.status_code in [200, 204]:
                print(f"✓ Discord notification sent")
                return True
            else:
                print(f"✗ Discord notification failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"✗ Discord notification error: {e}")
            return False
    

    def _send_telegram_message(
        self,
        bot_token: str,
        chat_id: str,
        message: str,
        image_path: Optional[str] = None
    ):
        try:
            # ถ้ามีรูปภาพ ส่งเป็น photo พร้อม caption
            if image_path:
                url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
                
                try:
                    with open(image_path, 'rb') as photo:
                        files = {'photo': photo}
                        data = {
                            'chat_id': chat_id,
                            'caption': message,
                            'parse_mode': 'HTML'
                        }
                        response = requests.post(url, data=data, files=files, timeout=10)
                except Exception as e:
                    print(f"Cannot send image: {e}, sending text only")
                    # ถ้าส่งรูปไม่ได้ ส่งแค่ข้อความ
                    return self._send_telegram_text(bot_token, chat_id, message)
            else:
                # ส่งแค่ข้อความ
                return self._send_telegram_text(bot_token, chat_id, message)
            
            if response.status_code == 200:
                print("✓ Telegram message sent")
                return True
            else:
                print(f"✗ Telegram failed: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            print(f"✗ Telegram error: {e}")
            return False
    

    def _send_telegram_text(self, bot_token: str, chat_id: str, message: str):
        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            data = {
                'chat_id': chat_id,
                'text': message,
                'parse_mode': 'HTML'
            }
            response = requests.post(url, data=data, timeout=5)
            
            if response.status_code == 200:
                print("✓ Telegram text sent")
                return True
            else:
                print(f"✗ Telegram text failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"✗ Telegram text error: {e}")
            return False
    

    def send_notification(
        self,
        message: str,
        notification_type: str,  # "match" or "unknown"
        camera_name: str,
        person_id: Optional[int] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        similarity: Optional[float] = None,
        image_path: Optional[str] = None,
        detected_at: Optional[datetime] = None
    ):
        # สร้าง key สำหรับ cooldown
        if notification_type == "match" and person_id:
            cooldown_key = f"person_{person_id}_{camera_name}"
        else:
            cooldown_key = f"unknown_{camera_name}"
        
        # ตรวจสอบ cooldown
        if not self._can_send_notification(cooldown_key):
            return False
        
        # สร้างข้อความ
        if detected_at is None:
            detected_at = datetime.now()
        
        time_str = detected_at.strftime("%Y-%m-%d %H:%M:%S")
        
        if notification_type == "match":
            # กรณีจับคู่ได้
            full_name = f"{first_name or 'Unknown'} {last_name or 'Person'}"
            full_message = (
                f"ตรวจพบบุคคล\n"
                f"ชื่อ: {full_name}\n"
                f"ID: #{person_id}\n"
                f"กล้อง: {camera_name}\n"
                f"เวลา: {time_str}"
            )
            if similarity:
                full_message += f"\nความแม่นยำ: {similarity:.1%}"
        else:
            # กรณีไม่รู้จัก (บุคคลใหม่)
            full_name = f"{first_name or 'Unknown'} {last_name or 'Person'}"
            full_message = (
                f"ตรวจพบบุคคลที่ไม่รู้จัก\n"
                f"ชื่อ: {full_name}\n"
                f"ID: #{person_id}\n"
                f"กล้อง: {camera_name}\n"
                f"เวลา: {time_str}"
            )
            if similarity:
                full_message += f"\nความคล้ายสูงสุด: {similarity:.1%}"
        
        # ส่งไปยังทุกช่องทาง
        channels = self._get_active_channels()
        success_count = 0
        
        for channel in channels:
            try:
                platform = channel.platform.lower()
                
                if platform == "line":
                    if self._send_line_push(
                        channel_token=channel.access_token,
                        target_id=channel.target_id,
                        message=full_message,
                        image_path=image_path
                    ):
                        success_count += 1

                elif platform == "discord":
                    if self._send_discord_webhook(
                        webhook_url=channel.target_id,
                        message=full_message,
                        image_path=image_path
                    ):
                        success_count += 1
                
                elif platform == "telegram":
                    # สำหรับ Telegram: access_token = bot_token, target_id = chat_id
                    if self._send_telegram_message(
                        bot_token=channel.access_token,
                        chat_id=channel.target_id,
                        message=full_message,
                        image_path=image_path
                    ):
                        success_count += 1
                        
            except Exception as e:
                print(f"Error sending to {channel.platform}: {e}")
        
        return success_count > 0
    

    def update_cooldown(self, cooldown_seconds: int):
        self.cooldown_seconds = cooldown_seconds
        print(f"[ INFO ] - Notification cooldown updated to {cooldown_seconds}s")