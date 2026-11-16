
from slowapi import Limiter
from slowapi.util import get_remote_address

# Limit requests based on client IP
limiter = Limiter(
    key_func=get_remote_address
)
