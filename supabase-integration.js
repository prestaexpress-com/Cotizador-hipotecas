(function () {
  const SC = window.SupabaseClient;
  if (!SC) {
    console.error('SupabaseClient no disponible. Carga supabase-client.js antes de supabase-integration.js');
    return;
  }

  let modoEdicion = false;
  let tokenActivo = null;
  let datosOriginales = null;
  let correlativoActual = null;

  function formatearCorrelativo(numero) {
    if (numero === null || numero === undefined) return '';
    return 'CH-' + String(numero).padStart(4, '0');
  }

  window.obtenerCorrelativoActual = function () {
    return correlativoActual ? formatearCorrelativo(correlativoActual) : '';
  };

  function recolectarDatos() {
    const hipotecas = [];
    document.querySelectorAll('.hipoteca-previa').forEach(h => {
      hipotecas.push({
        monto: parseFloat(h.querySelector('[name="monto-hipoteca"]')?.value) || 0,
        acreedor: h.querySelector('[name="acreedor"]')?.value || '',
        monto_ctp: parseFloat(h.querySelector('[name="monto-ctp"]')?.value) || 0
      });
    });

    const gastosLegales = (typeof gastosStore !== 'undefined') ? gastosStore.items.map(g => ({
      tipo: g.tipo,
      cantidad: g.cantidad,
      honorario: g.honorario,
      reembolso: g.reembolso,
      retenido: g.retenido,
      reembolso_ctp: g.reemborsoCTP
    })) : [];

    const otrosGastos = [];
    document.querySelectorAll('#lista-otros-gastos .eliminar-otro-gasto').forEach(btn => {
      const item = btn.closest('div.flex');
      if (item) {
        otrosGastos.push({
          nombre: item.querySelector('.font-medium')?.textContent || '',
          costo: parseFloat(item.querySelector('.otro-gasto-cost')?.value) || 0
        });
      }
    });

    const desembolsos = [];
    document.querySelectorAll('#desembolsos-container tr').forEach(row => {
      const beneficiario = row.querySelector('input[placeholder="Beneficiario"]')?.value || '';
      const monto = parseFloat(row.querySelector('input[type="number"]')?.value) || 0;
      if (beneficiario && monto > 0) {
        desembolsos.push({
          tipo: row.querySelector('select:first-child')?.value || '',
          beneficiario,
          monto,
          concepto: row.querySelector('td:nth-child(4) select')?.value || ''
        });
      }
    });

    const resumen = {};
    ['desglose-monto', 'desglose-intereses-mes', 'desglose-intereses-adelantados',
      'desglose-corretaje', 'desglose-gastos-admin', 'desglose-subtotal',
      'desglose-honorarios', 'desglose-timbre', 'desglose-registro', 'desglose-timbres',
      'desglose-otros-gastos-legales', 'desglose-otros-gastos',
      'desglose-total-gastos', 'desglose-total-recibe'].forEach(id => {
        const el = document.getElementById(id);
        if (el) resumen[id] = el.textContent;
      });

    const asesorEl = document.getElementById('asesor');
    return {
      empresa: document.getElementById('empresa')?.value || '',
      fecha_desembolso: document.getElementById('fecha-formulario')?.value || null,
      tipo_solicitud: document.getElementById('tipo-solicitud')?.value || '',
      cliente: document.getElementById('cliente')?.value || '',
      dpi: document.getElementById('dpi')?.value || '',
      nit: document.getElementById('nit')?.value || '',
      asesor: asesorEl?.options[asesorEl?.selectedIndex]?.text || '',
      moneda: document.getElementById('moneda')?.value || 'GTQ',
      tipo_prestamo: document.getElementById('tipo-prestamo')?.value || '',
      capital: parseFloat(document.getElementById('capital')?.value) || 0,
      interes: parseFloat(document.getElementById('interes')?.value) || 0,
      corretaje: parseFloat(document.getElementById('corretaje')?.value) || 0,
      gastos_admin: parseFloat(document.getElementById('gastos-admin')?.value) || 0,
      legal: parseFloat(document.getElementById('legal')?.value) || 0,
      cantidad_fincas: parseInt(document.getElementById('cantidad-fincas')?.value) || 0,
      meses_adelantar: parseInt(document.getElementById('meses-adelantar')?.value) || 0,
      tipo_impuesto: document.getElementById('tipo-impuesto')?.value || '',
      valor_rgp: parseFloat(document.getElementById('valor-rgp')?.value) || 0,
      valor_catastro: parseFloat(document.getElementById('valor-catastro')?.value) || 0,
      cancela_hipoteca: document.getElementById('cancela-hipoteca')?.checked || false,
      hipotecas_previas: hipotecas,
      gastos_legales: gastosLegales,
      otros_gastos: otrosGastos,
      desembolsos: desembolsos,
      resumen_financiero: resumen
    };
  }

  async function guardarOActualizar() {
    const datos = recolectarDatos();

    if (!datos.cliente || !datos.capital) {
      mostrarToast('⚠️ Primero calcula la cotización antes de generar el PDF.', 'warning');
      return null;
    }

    if (modoEdicion && tokenActivo) {
      try {
        const etiquetas = {
          cliente: 'Cliente', dpi: 'DPI', nit: 'NIT', empresa: 'Empresa',
          asesor: 'Asesor', capital: 'Capital', interes: '% Interés',
          corretaje: '% Corretaje', gastos_admin: '% Gastos Admin', legal: '% Legal',
          tipo_prestamo: 'Tipo préstamo', moneda: 'Moneda',
          fecha_desembolso: 'Fecha desembolso', tipo_solicitud: 'Tipo solicitud',
          meses_adelantar: 'Meses adelantados', cantidad_fincas: 'Cant. fincas',
          tipo_impuesto: 'Tipo impuesto', valor_rgp: 'Valor RGP',
          valor_catastro: 'Valor catastro'
        };

        const cambios = [];
        Object.keys(etiquetas).forEach(campo => {
          const antes = String(datosOriginales?.[campo] ?? '');
          const despues = String(datos[campo] ?? '');
          if (antes !== despues) {
            cambios.push({ campo, etiqueta: etiquetas[campo], antes, despues });
          }
        });

        const payload = {
          ...datos,
          fue_editado: true,
          editado_at: new Date().toISOString(),
          campos_editados: cambios
        };

        const tokenSeguro = encodeURIComponent(tokenActivo);
        const resultado = await SC.supabaseFetch(
          `cotizaciones?edit_token=eq.${tokenSeguro}`,
          'PATCH',
          payload
        );

        mostrarToast('✅ Cotización actualizada', 'success');
        const registro = Array.isArray(resultado) ? resultado[0] : resultado;
        return {
          token: tokenActivo,
          numero: registro?.numero ?? correlativoActual,
          esEdicion: true
        };
      } catch (err) {
        console.error(err);
        mostrarToast('❌ Error al actualizar: ' + err.message, 'error');
        return null;
      }
    }

    try {
      const resultado = await SC.supabaseFetch('cotizaciones', 'POST', datos);
      const registro = Array.isArray(resultado) ? resultado[0] : resultado;
      const token = registro.edit_token;
      correlativoActual = registro.numero;
      localStorage.setItem('ultimo_token', token);
      mostrarToast('✅ Cotización guardada (' + formatearCorrelativo(correlativoActual) + ')', 'success');
      return {
        token: token,
        numero: registro.numero,
        esEdicion: false
      };
    } catch (err) {
      console.error(err);
      mostrarToast('❌ Error al guardar: ' + err.message, 'error');
      return null;
    }
  }

  window.guardarParaPDF = guardarOActualizar;
  window.obtenerTokenActual = function () {
    return tokenActivo;
  };

  async function cargarPorToken() {
    const input = document.getElementById('sb-token-input');
    const token = input?.value?.trim();
    if (!token) {
      mostrarToast('⚠️ Ingresa un token válido', 'warning');
      return;
    }

    const btn = document.getElementById('btn-cargar-token');
    btn.disabled = true;
    btn.innerHTML = '<span class="sb-spinner"></span>';

    try {
      const tokenSeguro = encodeURIComponent(token);
      const data = await SC.supabaseFetch(`cotizaciones?edit_token=eq.${tokenSeguro}&select=*`);

      if (!data || data.length === 0) {
        mostrarToast('❌ Token no encontrado. Verifica e intenta de nuevo.', 'error');
        return;
      }

      const cotizacion = data[0];
      datosOriginales = { ...cotizacion };
      tokenActivo = token;
      correlativoActual = cotizacion.numero;
      llenarFormulario(cotizacion);
      activarModoEdicion(cotizacion.cliente);
      mostrarToast(`✅ Cotización de ${cotizacion.cliente} cargada`, 'success');
    } catch (err) {
      mostrarToast('❌ Error al cargar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-download"></i>';
    }
  }

  function llenarFormulario(c) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!val;
      else el.value = val ?? '';
    };

    set('empresa', c.empresa);
    set('fecha-formulario', c.fecha_desembolso);
    set('tipo-solicitud', c.tipo_solicitud);
    set('cliente', c.cliente);
    set('dpi', c.dpi);
    set('nit', c.nit);
    set('moneda', c.moneda);
    set('tipo-prestamo', c.tipo_prestamo);
    set('capital', c.capital);
    set('interes', c.interes);
    set('corretaje', c.corretaje);
    set('gastos-admin', c.gastos_admin);
    set('legal', c.legal);
    set('cantidad-fincas', c.cantidad_fincas);
    set('meses-adelantar', c.meses_adelantar);
    set('tipo-impuesto', c.tipo_impuesto);
    set('valor-rgp', c.valor_rgp);
    set('valor-catastro', c.valor_catastro);
    set('cancela-hipoteca', c.cancela_hipoteca);

    const simbolo = c.moneda === 'USD' ? '$' : 'Q';
    document.querySelectorAll('#simbolo-moneda, .input-group-text').forEach(el => {
      el.textContent = simbolo;
    });

    const headerEmpresa = document.getElementById('header-empresa');
    const printEmpresa = document.getElementById('print-empresa');
    const nombreEmpresa = c.empresa ? c.empresa.toUpperCase() : '';
    if (headerEmpresa) headerEmpresa.textContent = nombreEmpresa;
    if (printEmpresa) printEmpresa.textContent = nombreEmpresa;

    const asesorSel = document.getElementById('asesor');
    if (asesorSel && c.asesor) {
      for (let opt of asesorSel.options) {
        if (opt.text === c.asesor) { asesorSel.value = opt.value; break; }
      }
    }

    const hipContainer = document.getElementById('hipotecas-previas-container');
    const addHipBtn = document.getElementById('add-hipoteca');
    if (hipContainer && (c.hipotecas_previas || []).length > 0) {
      const existentes = hipContainer.querySelectorAll('.hipoteca-previa');
      existentes.forEach((h, i) => { if (i > 0) h.remove(); });

      c.hipotecas_previas.forEach((hip, idx) => {
        let hipEl;
        if (idx === 0) {
          hipEl = hipContainer.querySelector('.hipoteca-previa');
        } else {
          hipEl = hipContainer.querySelector('.hipoteca-previa').cloneNode(true);
          hipEl.querySelector('h3').textContent = `Hipoteca Previa ${idx + 1}`;
          hipEl.querySelector('.btn-eliminar-hipoteca').disabled = false;
          addHipBtn.before(hipEl);
        }
        if (!hipEl) return;
        hipEl.querySelector('[name="monto-hipoteca"]').value = hip.monto || '';
        hipEl.querySelector('[name="acreedor"]').value = hip.acreedor || '';
        hipEl.querySelector('[name="monto-ctp"]').value = hip.monto_ctp || '';
      });

      if (c.hipotecas_previas.length > 1) {
        hipContainer.querySelectorAll('.btn-eliminar-hipoteca').forEach(btn => btn.disabled = false);
      }
    }

    const hipotecasContainer = document.getElementById('hipotecas-previas-container');
    if (hipotecasContainer) {
      hipotecasContainer.style.display = c.cancela_hipoteca ? 'block' : 'none';
    }

    if (typeof gastosStore !== 'undefined') {
      gastosStore.items = [];
      (c.gastos_legales || []).forEach(g => {
        gastosStore.items.push({
          id: Date.now() + Math.random(),
          tipo: g.tipo,
          cantidad: g.cantidad || 1,
          honorario: parseFloat(g.honorario) || 0,
          reembolso: parseFloat(g.reembolso) || 0,
          retenido: parseFloat(g.retenido) || 0,
          reemborsoCTP: parseFloat(g.reembolso_ctp) || 0,
          total: (parseFloat(g.honorario) || 0) + (parseFloat(g.reembolso) || 0) + (parseFloat(g.retenido) || 0) + (parseFloat(g.reembolso_ctp) || 0)
        });
      });
      gastosStore.renderAll();
    }

    const listaOtros = document.getElementById('lista-otros-gastos');
    const noOtros = document.getElementById('no-otros-gastos');
    if (listaOtros) {
      Array.from(listaOtros.querySelectorAll('div.flex')).forEach(el => el.remove());

      const otrosGastos = c.otros_gastos || [];
      if (otrosGastos.length > 0) {
        if (noOtros) noOtros.style.display = 'none';
        otrosGastos.forEach(g => {
          const item = document.createElement('div');
          item.className = 'flex justify-between items-center p-2 mb-2 bg-white border rounded';
          const nombreEsc = SC.escapeHtml(g.nombre);
          const costoNum = parseFloat(g.costo) || 0;
          item.innerHTML = `
            <div>
              <p class="font-medium">${nombreEsc}</p>
              <p class="text-sm text-gray-600">Costo: Q ${costoNum.toFixed(2)}</p>
              <input type="hidden" class="otro-gasto-value" value="${nombreEsc}">
              <input type="hidden" class="otro-gasto-cost" value="${costoNum}">
            </div>
            <button class="eliminar-otro-gasto text-red-500 hover:text-red-700">
              <i class="fas fa-trash"></i>
            </button>
          `;
          listaOtros.appendChild(item);
        });
      } else {
        if (noOtros) noOtros.style.display = 'block';
      }
    }

    const desembolsosContainer = document.getElementById('desembolsos-container');
    if (desembolsosContainer) {
      desembolsosContainer.innerHTML = '';
      const desembolsos = c.desembolsos || [];
      if (desembolsos.length === 0) {
        if (typeof addNewDesembolsoRow === 'function') addNewDesembolsoRow();
      } else {
        desembolsos.forEach(d => {
          if (typeof addNewDesembolsoRow === 'function') addNewDesembolsoRow();
          const rows = desembolsosContainer.querySelectorAll('tr');
          const row = rows[rows.length - 1];
          if (!row) return;

          const sel1 = row.querySelector('select:first-child') || row.querySelector('td:first-child select');
          if (sel1) sel1.value = d.tipo || '';

          const benInput = row.querySelector('input[placeholder="Beneficiario"]');
          if (benInput) benInput.value = d.beneficiario || '';

          const montoInput = row.querySelector('input[type="number"]');
          if (montoInput) montoInput.value = d.monto || 0;

          const sel4 = row.querySelector('td:nth-child(4) select');
          if (sel4) sel4.value = d.concepto || '';
        });
      }
    }

    ['empresa', 'capital', 'interes', 'corretaje', 'gastos-admin', 'legal',
      'meses-adelantar', 'cantidad-fincas', 'valor-rgp', 'valor-catastro', 'moneda'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
  }

  function activarModoEdicion(nombreCliente) {
    modoEdicion = true;
    const banner = document.getElementById('sb-edicion-banner');
    if (banner) {
      banner.style.display = 'flex';
      document.getElementById('sb-edicion-nombre').textContent = nombreCliente || 'cliente';
    }
    const input = document.getElementById('sb-token-input');
    if (input) input.value = '';
  }

  function salirModoEdicion() {
    modoEdicion = false;
    tokenActivo = null;
    datosOriginales = null;
    correlativoActual = null;
    const banner = document.getElementById('sb-edicion-banner');
    if (banner) banner.style.display = 'none';
  }

  function mostrarModalToken(token, cliente, numero) {
    const tokenEsc = SC.escapeHtml(token);
    const clienteEsc = SC.escapeHtml(cliente);
    const correlativoEsc = SC.escapeHtml(formatearCorrelativo(numero));
    const enlace = `${window.location.origin}/ver-cotizacion.html?token=${encodeURIComponent(token)}`;
    const enlaceEsc = SC.escapeHtml(enlace);

    const modal = document.createElement('div');
    modal.id = 'modal-token';
    modal.innerHTML = `
      <div class="sb-modal-overlay">
        <div class="sb-modal-box">
          <div class="sb-modal-header">
            <div class="sb-check-icon">✓</div>
            <h2>¡Cotización guardada!</h2>
            <p>Para <strong>${clienteEsc}</strong></p>
            ${correlativoEsc ? `<p style="margin-top:6px;font-size:12px;opacity:0.75;font-family:monospace;letter-spacing:0.5px">Ref. ${correlativoEsc}</p>` : ''}
          </div>
          <div class="sb-modal-body">
            <p class="sb-label">Token de acceso del cliente</p>
            <div class="sb-token-box">
              <span id="sb-token-text">${tokenEsc}</span>
              <button data-copy-target="token" class="sb-copy-btn" title="Copiar">
                <i class="fas fa-copy"></i>
              </button>
            </div>
            <p class="sb-hint">⚠️ Comparte este token con el cliente. Con él podrá ver y editar su cotización.</p>

            <p class="sb-label" style="margin-top:16px">Enlace directo</p>
            <div class="sb-token-box">
              <span style="font-size:11px;word-break:break-all">${enlaceEsc}</span>
              <button data-copy-target="enlace" class="sb-copy-btn" title="Copiar enlace">
                <i class="fas fa-link"></i>
              </button>
            </div>
          </div>
          <div class="sb-modal-footer">
            <button data-close="modal-token" class="sb-btn-cerrar">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('[data-copy-target="token"]').addEventListener('click', () => copiarYAvisar(token));
    modal.querySelector('[data-copy-target="enlace"]').addEventListener('click', () => copiarYAvisar(enlace));
    modal.querySelector('[data-close="modal-token"]').addEventListener('click', () => modal.remove());
  }

  function copiarYAvisar(texto) {
    SC.copiarTexto(texto).then(() => mostrarToast('✅ Copiado al portapapeles', 'success'));
  }

  function mostrarToast(msg, tipo = 'success') {
    const t = document.createElement('div');
    t.className = `sb-toast sb-toast-${tipo}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('sb-toast-show'), 10);
    setTimeout(() => { t.classList.remove('sb-toast-show'); setTimeout(() => t.remove(), 400); }, 3500);
  }

  document.addEventListener('DOMContentLoaded', function () {
    const tokenWrap = document.createElement('div');
    tokenWrap.id = 'sb-token-wrap';
    tokenWrap.innerHTML = `
      <div class="sb-token-load-header">
        <span class="sb-token-load-label"><i class="fas fa-key"></i> Cargar cotización existente</span>
        <button class="sb-token-close" id="sb-token-close-btn" title="Cerrar">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="sb-token-load-row">
        <input type="text" id="sb-token-input" class="sb-token-load-input"
          placeholder="Pega el token para editar una cotización...">
        <button id="btn-cargar-token" class="sb-token-load-btn" title="Cargar">
          <i class="fas fa-arrow-right"></i> Cargar
        </button>
      </div>
    `;
    document.body.appendChild(tokenWrap);

    document.getElementById('sb-token-close-btn').addEventListener('click', () => {
      tokenWrap.style.display = 'none';
    });
    document.getElementById('btn-cargar-token').addEventListener('click', cargarPorToken);
    document.getElementById('sb-token-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') cargarPorToken();
    });

    const banner = document.createElement('div');
    banner.id = 'sb-edicion-banner';
    banner.style.display = 'none';
    banner.innerHTML = `
      <i class="fas fa-pencil-alt"></i>
      Modo edición — Cotización de <strong id="sb-edicion-nombre"></strong>
      <button id="sb-banner-salir-btn" class="sb-banner-salir" title="Cancelar edición">
        <i class="fas fa-times"></i> Cancelar
      </button>
    `;
    document.body.appendChild(banner);
    document.getElementById('sb-banner-salir-btn').addEventListener('click', salirModoEdicion);

    const btnAdmin = document.createElement('button');
    btnAdmin.id = 'btn-admin-discreto';
    btnAdmin.title = '';
    btnAdmin.innerHTML = '<i class="fas fa-lock"></i>';
    btnAdmin.addEventListener('click', () => {
      window.location.href = 'admin.html';
    });
    document.body.appendChild(btnAdmin);

    const style = document.createElement('style');
    style.textContent = `
      .sb-spinner {
        width: 14px; height: 14px;
        border: 2px solid rgba(255,255,255,0.4);
        border-top-color: white;
        border-radius: 50%;
        display: inline-block;
        animation: sb-spin 0.7s linear infinite;
      }
      @keyframes sb-spin { to { transform: rotate(360deg); } }

      .sb-modal-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.6);
        display: flex; align-items: center; justify-content: center;
        z-index: 99999;
        animation: sb-fade-in 0.2s ease;
      }
      @keyframes sb-fade-in { from { opacity: 0; } to { opacity: 1; } }

      .sb-modal-box {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 500px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        overflow: hidden;
        animation: sb-slide-up 0.3s ease;
      }
      @keyframes sb-slide-up { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

      .sb-modal-header {
        background: linear-gradient(135deg, #00B884, #009970);
        color: white;
        padding: 28px 24px 20px;
        text-align: center;
      }
      .sb-check-icon {
        width: 52px; height: 52px;
        background: rgba(255,255,255,0.25);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 24px; font-weight: bold;
        margin: 0 auto 12px;
      }
      .sb-modal-header h2 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
      .sb-modal-header p { opacity: 0.85; font-size: 14px; }

      .sb-modal-body { padding: 24px; }
      .sb-label { font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }

      .sb-token-box {
        display: flex;
        align-items: center;
        background: #f4f4f6;
        border: 1px solid #e0e0e5;
        border-radius: 8px;
        padding: 10px 12px;
        gap: 10px;
        font-family: monospace;
        font-size: 13px;
        color: #333;
        word-break: break-all;
      }
      .sb-token-box span { flex: 1; }
      .sb-copy-btn {
        background: #FF6B00;
        color: white;
        border: none;
        border-radius: 6px;
        width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        transition: all 0.2s;
      }
      .sb-copy-btn:hover { background: #E05600; }

      .sb-hint {
        margin-top: 12px;
        font-size: 12px;
        color: #888;
        background: #fffbea;
        border: 1px solid #ffe58f;
        border-radius: 6px;
        padding: 10px;
      }

      .sb-modal-footer {
        padding: 16px 24px;
        border-top: 1px solid #eee;
        display: flex;
        justify-content: flex-end;
      }
      .sb-btn-cerrar {
        background: #f0f0f2;
        border: none;
        border-radius: 8px;
        padding: 10px 24px;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      .sb-btn-cerrar:hover { background: #e0e0e4; }

      .sb-toast {
        position: fixed;
        bottom: 24px; right: 24px;
        background: #222;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 999999;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      }
      .sb-toast-show { opacity: 1; transform: translateY(0); }
      .sb-toast-success { background: #00B884; }
      .sb-toast-warning { background: #FFB800; color: #333; }
      .sb-toast-error { background: #FF5252; }

      #sb-token-wrap {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 9999;
        background: white;
        border: 1.5px solid rgba(255,107,0,0.25);
        border-radius: 12px;
        padding: 12px 14px;
        box-shadow: 0 4px 20px rgba(255,107,0,0.12);
        min-width: 320px;
        max-width: 380px;
      }
      .sb-token-load-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .sb-token-load-label {
        font-size: 11px;
        font-weight: 700;
        color: #FF6B00;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .sb-token-close {
        background: none;
        border: none;
        color: #bbb;
        font-size: 12px;
        cursor: pointer;
        padding: 2px 5px;
        border-radius: 4px;
        transition: all 0.2s;
        line-height: 1;
      }
      .sb-token-close:hover { color: #FF6B00; background: rgba(255,107,0,0.08); }
      .sb-token-load-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .sb-token-load-input {
        flex: 1;
        border: 1.5px solid #e8e0d8;
        border-radius: 7px;
        padding: 8px 12px;
        font-size: 12px;
        font-family: monospace;
        color: #333;
        outline: none;
        transition: border-color 0.2s;
        background: #fdf8f4;
        min-width: 0;
      }
      .sb-token-load-input:focus { border-color: #FF6B00; box-shadow: 0 0 0 3px rgba(255,107,0,0.10); background: white; }
      .sb-token-load-input::placeholder { color: #ccc; font-family: sans-serif; font-size: 11px; }
      .sb-token-load-btn {
        height: 36px;
        padding: 0 14px;
        background: linear-gradient(135deg, #FF6B00, #C94E00);
        color: white;
        border: none;
        border-radius: 7px;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        flex-shrink: 0;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(255,107,0,0.30);
      }
      .sb-token-load-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255,107,0,0.40); }
      .sb-token-load-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

      #sb-edicion-banner {
        position: fixed;
        top: 0; left: 0; right: 0;
        background: linear-gradient(135deg, #3B82F6, #1D4ED8);
        color: white;
        padding: 10px 20px;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 99998;
        box-shadow: 0 2px 12px rgba(59,130,246,0.4);
        animation: sb-slide-down 0.3s ease;
      }
      @keyframes sb-slide-down { from { transform: translateY(-100%); } to { transform: translateY(0); } }
      #sb-edicion-banner strong { color: #BAE6FD; }
      .sb-banner-salir {
        margin-left: auto;
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        border-radius: 6px;
        padding: 5px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex; align-items: center; gap: 6px;
        transition: all 0.2s;
      }
      .sb-banner-salir:hover { background: rgba(255,255,255,0.35); }

      #btn-admin-discreto {
        position: fixed;
        bottom: 16px;
        left: 16px;
        width: 28px;
        height: 28px;
        background: transparent;
        border: none;
        border-radius: 50%;
        color: rgba(150,150,150,0.25);
        font-size: 11px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        z-index: 100;
        padding: 0;
      }
      #btn-admin-discreto:hover {
        color: rgba(255,107,0,0.7);
        background: rgba(255,107,0,0.08);
        transform: scale(1.15);
      }
    `;
    document.head.appendChild(style);
  });
})();
