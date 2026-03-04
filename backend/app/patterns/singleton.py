"""
Патерн Singleton (Одинак) — GoF.

Обґрунтування вибору:
- Гарантує, що клас має лише один екземпляр протягом
  життєвого циклу програми.
- Надає глобальну точку доступу до цього екземпляра.
- Дотримання принципу DRY: уникаємо повторного створення
  тяжких об'єктів (менеджер подій, фабрики).

Використання у проєкті:
- SingletonMeta: метаклас, що забезпечує єдиний екземпляр.
- Застосовується до EventManager, CardFactory, BoardFactory.
"""

import threading
from abc import ABCMeta


class SingletonMeta(ABCMeta):
    """
    Потокобезпечний метаклас Singleton (GoF).
    Наслідує ABCMeta для сумісності з ABC-класами.

    Використання:
        class MyClass(metaclass=SingletonMeta):
            pass

        obj1 = MyClass()
        obj2 = MyClass()
        assert obj1 is obj2  # True — один і той самий об'єкт
    """

    _instances: dict[type, object] = {}
    _lock: threading.Lock = threading.Lock()

    def __call__(cls, *args, **kwargs):
        """
        Перевіряє, чи існує вже екземпляр класу.
        Якщо ні — створює його (thread-safe через Lock).
        """
        with cls._lock:
            if cls not in cls._instances:
                instance = super().__call__(*args, **kwargs)
                cls._instances[cls] = instance
        return cls._instances[cls]

    @classmethod
    def _reset(mcs, cls: type) -> None:
        """Скинути Singleton-екземпляр (для тестування)."""
        with mcs._lock:
            mcs._instances.pop(cls, None)
