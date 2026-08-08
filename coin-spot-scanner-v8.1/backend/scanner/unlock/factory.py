from .service import OfficialScheduleProvider
from .providers import PublicWebUnlockProvider

def build_unlock_providers(settings=None):
    """Free-first factory; optional providers are not registered without verified config."""
    providers = [OfficialScheduleProvider()]
    if PublicWebUnlockProvider.enabled():
        providers.append(PublicWebUnlockProvider())
    return tuple(providers)
