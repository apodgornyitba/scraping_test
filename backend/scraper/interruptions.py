import time
import logging

logger = logging.getLogger(__name__)

def handle_interruptions(page):
    """Cierra cualquier modal o aviso operativo (pop-ups de ARCA) que pueda interferir."""
    try:
        close_btn = page.locator("button:has-text('Cerrar aviso'), button:has-text('Cerrar'), button:has-text('Aceptar')")
        if close_btn.count() > 0:
            for i in range(close_btn.count()):
                btn = close_btn.nth(i)
                if btn.is_visible():
                    logger.info(f"Interrupción detectada. Cerrando modal con botón: '{btn.inner_text().strip()}'...")
                    btn.click()
                    page.wait_for_load_state("networkidle")
                    time.sleep(1)
    except Exception as e:
        logger.warning(f"Error al intentar cerrar interrupciones: {str(e)}")
