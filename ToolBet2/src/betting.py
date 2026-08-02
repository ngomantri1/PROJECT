from __future__ import annotations

import logging

from playwright.async_api import Page

from src.models import BetSide

logger = logging.getLogger(__name__)

SIDE_UI_SELECTORS = {
    BetSide.PLAYER: [
        "text=/^player$/i",
        "text=/người chơi/i",
        "[data-bet='player']",
        "[class*='player']:not([class*='pair'])",
        "div.bet-player",
    ],
    BetSide.BANKER: [
        "text=/^banker$/i",
        "text=/nhà cái/i",
        "[data-bet='banker']",
        "[class*='banker']:not([class*='pair'])",
        "div.bet-banker",
    ],
}

CHIP_SELECTORS = [
    "[class*='chip']",
    "[data-chip]",
    "button[class*='bet-amount']",
]


async def _click_first_visible(page: Page, selectors: list[str], timeout: int = 3000) -> bool:
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if await loc.is_visible(timeout=timeout):
                await loc.click()
                return True
        except Exception:
            continue
    return False


async def select_chip_amount(page: Page, amount: int) -> bool:
    """Chọn chip theo số tiền — site có thể dùng chip cố định, cần tinh chỉnh."""
    amount_selectors = [
        f"text=/{amount}/",
        f"[data-value='{amount}']",
        f"button:has-text('{amount}')",
    ]
    if await _click_first_visible(page, amount_selectors):
        logger.info("Đã chọn chip %s", amount)
        return True

    # Fallback: click chip gần nhất hoặc nhập số
    for sel in CHIP_SELECTORS:
        try:
            chips = page.locator(sel)
            count = await chips.count()
            for i in range(count):
                chip = chips.nth(i)
                text = await chip.inner_text()
                if str(amount) in text:
                    await chip.click()
                    logger.info("Đã chọn chip %s (fallback)", amount)
                    return True
        except Exception:
            continue

    logger.warning("Không chọn được chip %s — sẽ thử đặt cược trực tiếp", amount)
    return False


async def place_bet(page: Page, side: BetSide, amount: int) -> bool:
    """Đặt cược vào cửa Player/Banker với số tiền chỉ định."""
    await select_chip_amount(page, amount)

    selectors = SIDE_UI_SELECTORS.get(side, [])
    if await _click_first_visible(page, selectors, timeout=5000):
        label = "xanh" if side == BetSide.PLAYER else "đỏ"
        logger.info("Đã đặt cược %s — %s (%s)", amount, label, side.value)
        return True

    logger.error("Không đặt được cược %s %s — cần cập nhật selector", side.value, amount)
    return False


async def is_betting_phase(page: Page) -> bool:
    """Kiểm tra có đang trong phase cho phép cược không."""
    indicators = [
        "text=/đặt cược/i",
        "text=/place bet/i",
        "[class*='countdown']",
        "[class*='betting']",
    ]
    for sel in indicators:
        try:
            if await page.locator(sel).first.is_visible(timeout=1500):
                return True
        except Exception:
            continue
    return True  # mặc định cho phép thử nếu không detect được
