import os
import sys
import json
import time
import logging
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from backend.database.connection import SessionLocal
from backend.database.models import Contribuyente, Deuda, DeudaSnapshot
from backend.scraper.interruptions import handle_interruptions
from backend.scraper.parser import clean_currency, parse_taxpayer_metadata

logger = logging.getLogger(__name__)

def run_scraper(user, headless=True):
    """Ejecuta el scraper para un usuario específico, guardando datos históricos en base de datos."""
    username = user['username']
    password = user['password']
    taxpayer_name = user.get('taxpayerName', 'Desconocido')
    cuit = user.get('cuit', 'Desconocido')
    
    logger.info(f"Iniciando scraping para el contribuyente: {taxpayer_name} (CUIT: {cuit}, Usuario: {username})")
    
    # Crear carpeta para capturas de pantalla de depuración en la estructura backend/data/captures
    captures_dir = os.path.join('backend', 'data', 'captures')
    os.makedirs(captures_dir, exist_ok=True)
    screenshot_prefix = os.path.join(captures_dir, username)
    
    data = []
    
    with sync_playwright() as p:
        # Lanzar el navegador
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        
        page = context.new_page()
        
        try:
            # 1. Navegar a la URL objetivo
            logger.info("Navegando a https://scraping.gaixl.xyz ...")
            page.goto("https://scraping.gaixl.xyz", wait_until="networkidle")
            page.screenshot(path=f"{screenshot_prefix}_0_landing.png")
            
            # 2. Iniciar sesión
            logger.info("Completando formulario de inicio de sesión...")
            page.fill("input#username", username)
            page.fill("input#password", password)
            page.screenshot(path=f"{screenshot_prefix}_1_filled.png")
            
            logger.info("Haciendo clic en el botón de Ingresar...")
            page.click("button[type='submit']")
            
            # Esperar a que la página cambie o cargue el dashboard
            logger.info("Esperando redirección al panel de control...")
            page.wait_for_load_state("networkidle")
            time.sleep(2)  # Pequeño delay de seguridad para que renderice
            
            # CERRAR INTERRUPCIONES SI LAS HAY
            handle_interruptions(page)
            
            page.screenshot(path=f"{screenshot_prefix}_2_dashboard.png")
            
            # Analizar el contenido actual de la página para planificar la navegación
            title = page.title()
            logger.info(f"Título de la página después del login: '{title}'")
            
            body_text = page.inner_text("body")
            logger.info("=== CONTENIDO TEXTUAL DE LA PÁGINA ===")
            logger.info("\n" + body_text[:2000] + ("\n... [TRUNCADO]" if len(body_text) > 2000 else ""))
            logger.info("=======================================")
            
            # Extraer y estructurar metadatos del contribuyente
            logger.info("Extrayendo metadatos del contribuyente del panel principal...")
            metadata = parse_taxpayer_metadata(body_text, username)
            if metadata.get("cuit") == "Desconocido" or not metadata.get("cuit"):
                metadata["cuit"] = cuit
            if metadata.get("nombre") == "Desconocido" or not metadata.get("nombre"):
                metadata["nombre"] = taxpayer_name
            
            # Guardar/actualizar contribuyente en la base de datos
            db = SessionLocal()
            try:
                contribuyente = db.query(Contribuyente).filter_by(usuario=username).first()
                if not contribuyente:
                    contribuyente = Contribuyente(cuit=metadata["cuit"], usuario=username)
                    db.add(contribuyente)
                else:
                    # En caso de que se necesite re-asociar por CUIT
                    contribuyente.cuit = metadata["cuit"]
                
                contribuyente.nombre = metadata["nombre"]
                contribuyente.actividad = metadata["actividad"]
                contribuyente.regimen = metadata["regimen"]
                contribuyente.forma_juridica = metadata["forma_juridica"]
                contribuyente.agencia = metadata["agencia"]
                contribuyente.email = metadata["email"]
                contribuyente.domicilio = metadata["domicilio"]
                contribuyente.riesgo_fiscal = metadata["riesgo_fiscal"]
                contribuyente.score_cumplimiento = metadata["score_cumplimiento"]
                contribuyente.embargos_activos = metadata["embargos_activos"]
                contribuyente.mesa_fiscalizacion = metadata["mesa_fiscalizacion"]
                
                db.commit()
                logger.info(f"Contribuyente {username} guardado/actualizado en DB exitosamente.")
            except Exception as dbe:
                logger.error(f"Error al guardar contribuyente en DB: {str(dbe)}")
                db.rollback()
            finally:
                db.close()
            
            # Verificar si hay iframes o frames
            frames = page.frames
            logger.info(f"La página contiene {len(frames)} frames/iframes:")
            for idx, frame in enumerate(frames):
                logger.info(f"  Frame {idx}: Name='{frame.name}', URL='{frame.url}'")
            
            # Buscar botones o selectores que puedan representar meses o navegación
            buttons = page.locator("button, a, select").all()
            logger.info(f"Se encontraron {len(buttons)} elementos interactivos (botones/links/selects):")
            for idx, btn in enumerate(buttons[:30]):  # Mostrar los primeros 30
                try:
                    tag = btn.evaluate("el => el.tagName.toLowerCase()")
                    text = btn.inner_text() or btn.get_attribute("placeholder") or btn.get_attribute("value") or "Sin texto"
                    id_attr = btn.get_attribute("id") or "Sin ID"
                    class_attr = btn.get_attribute("class") or "Sin Class"
                    logger.info(f"  Elemento {idx}: Tag={tag}, ID={id_attr}, Class={class_attr}, Texto='{text.strip()}'")
                except Exception:
                    pass
            
            # --- ESPACIO PARA LÓGICA ESPECÍFICA DE EXTRACCIÓN ---
            logger.info("Navegando a la sección CCMA...")
            page.locator("a.btn", has_text="CCMA").first.click()
            page.wait_for_load_state("networkidle")
            time.sleep(2)
            handle_interruptions(page)
            page.screenshot(path=f"{screenshot_prefix}_3_ccma.png")
            
            # Inspeccionar el selector de fecha para ver rango disponible
            date_input = page.locator("#global-date")
            min_date = "2023-01"  # Valor por defecto inicial
            max_date = "2025-06"  # Valor por defecto final
            
            try:
                min_attr = date_input.get_attribute("min")
                max_attr = date_input.get_attribute("max")
                if min_attr:
                    min_date = min_attr
                if max_attr:
                    max_date = max_attr
                logger.info(f"Rango de fechas detectado: Min={min_date}, Max={max_date}")
            except Exception as e:
                logger.warning(f"No se pudieron leer los atributos min/max de fecha: {str(e)}")
            
            # Generar lista de meses YYYY-MM
            start_year, start_month = map(int, min_date.split("-"))
            end_year, end_month = map(int, max_date.split("-"))
            
            months = []
            curr_year, curr_month = start_year, start_month
            while (curr_year < end_year) or (curr_year == end_year and curr_month <= end_month):
                months.append(f"{curr_year:04d}-{curr_month:02d}")
                curr_month += 1
                if curr_month > 12:
                    curr_month = 1
                    curr_year += 1
            
            logger.info(f"Se procesarán {len(months)} meses en total para el usuario {username}.")
            
            # Extraer filas para cada mes/corte
            for month in months:
                logger.info(f"Scraping corte: {month}...")
                try:
                    # Asegurarse de que no haya avisos operativos tapando la interfaz
                    handle_interruptions(page)
                    
                    try:
                        # Rellenar el selector de fecha y aplicar
                        date_input.fill(month)
                        page.locator("input[value='Aplicar']").click()
                    except Exception as click_err:
                        logger.warning(f"Error al aplicar fecha {month}, reintentando tras chequear avisos: {str(click_err)}")
                        # Si falló (ej. tapado por aviso emergente), cerramos avisos y reintentamos
                        handle_interruptions(page)
                        date_input.fill(month)
                        page.locator("input[value='Aplicar']").click()
                        
                    page.wait_for_load_state("networkidle")
                    time.sleep(1)
                    
                    # Cerrar avisos operativos si aparecen después del clic
                    handle_interruptions(page)
                    
                    # Extraer cabeceras de la tabla
                    headers = page.locator("table th").all_inner_texts()
                    headers_clean = [h.strip() for h in headers]
                    
                    rows = page.locator("table tbody tr").all()
                    month_data_count = 0
                    
                    db = SessionLocal()
                    try:
                        for row in rows:
                            cols = row.locator("td").all_inner_texts()
                            if len(cols) >= 10:
                                periodo = cols[1].strip()
                                concepto = cols[2].strip()
                                vencimiento = cols[3].strip()
                                capital = clean_currency(cols[4])
                                int_resarcitorio = clean_currency(cols[5])
                                int_punitorio = clean_currency(cols[6])
                                total = clean_currency(cols[7])
                                estado = cols[8].strip()
                                expediente = cols[9].strip()
                                
                                if periodo and concepto:
                                    # 1. Obtener o crear Deuda
                                    deuda = db.query(Deuda).filter_by(cuit=metadata["cuit"], periodo=periodo, concepto=concepto).first()
                                    if not deuda:
                                        deuda = Deuda(cuit=metadata["cuit"], periodo=periodo, concepto=concepto, vencimiento=vencimiento)
                                        db.add(deuda)
                                        db.flush()
                                    else:
                                        deuda.vencimiento = vencimiento
                                    
                                    # 2. Obtener o crear DeudaSnapshot para esta corte (month)
                                    snapshot = db.query(DeudaSnapshot).filter_by(deuda_id=deuda.id, corte=month).first()
                                    if not snapshot:
                                        snapshot = DeudaSnapshot(deuda_id=deuda.id, corte=month)
                                        db.add(snapshot)
                                    
                                    snapshot.capital = capital
                                    snapshot.interes_resarcitorio = int_resarcitorio
                                    snapshot.interes_punitorio = int_punitorio
                                    snapshot.total = total
                                    snapshot.estado = estado
                                    snapshot.expediente = expediente
                                    
                                    row_data = {
                                        "corte": month,
                                        "usuario": username,
                                        "cuit": metadata["cuit"],
                                        "contribuyente": metadata["nombre"],
                                        "periodo": periodo,
                                        "concepto": concepto,
                                        "vencimiento": vencimiento,
                                        "capital": capital,
                                        "int_resarcitorio": int_resarcitorio,
                                        "int_punitorio": int_punitorio,
                                        "total": total,
                                        "estado": estado,
                                        "expediente": expediente
                                    }
                                    data.append(row_data)
                                    month_data_count += 1
                        
                        db.commit()
                        logger.info(f"Mes {month}: Se extrajeron y guardaron {month_data_count} registros en la base de datos.")
                    except Exception as dbe:
                        logger.error(f"Error de base de datos en mes {month} para {username}: {str(dbe)}")
                        db.rollback()
                    finally:
                        db.close()
                except Exception as me:
                    logger.error(f"Error procesando el mes {month} para {username}: {str(me)}")
                    page.screenshot(path=f"{screenshot_prefix}_error_{month}.png")
            
            # Guardar los datos en un archivo JSON local en la estructura backend/data/json
            json_dir = os.path.join('backend', 'data', 'json')
            os.makedirs(json_dir, exist_ok=True)
            output_filepath = os.path.join(json_dir, f"debts_{username}.json")
            with open(output_filepath, 'w', encoding='utf-8') as out_f:
                json.dump(data, out_f, indent=2, ensure_ascii=False)
            logger.info(f"Se guardaron {len(data)} registros para el usuario {username} en {output_filepath}")
            
        except PlaywrightTimeoutError as te:
            logger.error(f"Error de tiempo de espera en el scraper para {username}: {str(te)}")
            page.screenshot(path=f"{screenshot_prefix}_error_timeout.png")
        except Exception as e:
            logger.error(f"Error inesperado en el scraper para {username}: {str(e)}")
            page.screenshot(path=f"{screenshot_prefix}_error_unexpected.png")
        finally:
            context.close()
            browser.close()
            
    return data
