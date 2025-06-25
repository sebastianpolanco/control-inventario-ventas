import emailjs from 'emailjs-com';

// Actualiza estos valores desde tu dashboard de EmailJS
const PUBLIC_KEY = '3ySAsAYSUnAnBLAnt';
const TEMPLATE_ID = 'template_54ooptv';
const SERVICE_ID = 'service_uw593ag';  // Este es el nuevo service ID correcto

// Inicializar EmailJS
emailjs.init(PUBLIC_KEY);

export const sendFacturaEmail = async (emailData) => {
  try {
    const formatearNumero = (numero) => {
      return new Intl.NumberFormat('es-CO').format(Number(numero) || 0);
    };

    // Format invoice number to show only numbers
    const numeroFactura = String(emailData.facturaId).replace(/\D/g, '').padStart(4, '0');

    // Crear tabla HTML de productos
    const productosHTML = emailData.productos.map(p => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${p.nombre}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${p.cantidadVenta}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${formatearNumero(p.precio)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${formatearNumero(p.precio * p.cantidadVenta)}</td>
      </tr>
    `).join('');

    const templateParams = {
      to_email: emailData.email,
      to_name: emailData.cliente?.nombre || emailData.email.split('@')[0],
      subject: `Factura #${numeroFactura} - Mi Negocio`,
      message_html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #333;">FACTURA DE VENTA</h1>
            <p style="font-size: 18px;">Mi Negocio</p>
            <p>NIT: 123456789-0</p>
            <p>Dirección: Calle Principal #123</p>
            <p>Email: contacto@minegocio.com</p>
          </div>

          <div style="margin-bottom: 20px;">
            <h3>Información de la Factura</h3>
            <p><strong>Factura #:</strong> ${numeroFactura}</p>
            <p><strong>Fecha:</strong> ${emailData.fecha}</p>
            <p><strong>Método de Pago:</strong> ${emailData.metodoPago}</p>
            ${emailData.metodoPago === 'efectivo' ? `
              <p><strong>Efectivo:</strong> $${formatearNumero(emailData.efectivo)}</p>
              <p><strong>Cambio:</strong> $${formatearNumero(emailData.cambio)}</p>
            ` : ''}
          </div>

          ${emailData.cliente ? `
            <div style="margin-bottom: 20px;">
              <h3>Datos del Cliente</h3>
              <p><strong>Nombre:</strong> ${emailData.cliente.nombre}</p>
              ${emailData.cliente.identificacion ? `<p><strong>Identificación:</strong> ${emailData.cliente.identificacion}</p>` : ''}
              ${emailData.cliente.direccion ? `<p><strong>Dirección:</strong> ${emailData.cliente.direccion}</p>` : ''}
              <p><strong>Email:</strong> ${emailData.cliente.email}</p>
            </div>
          ` : ''}

          <div style="margin-bottom: 20px;">
            <h3>Detalle de Productos</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f8f9fa;">
                  <th style="padding: 8px; text-align: left;">Producto</th>
                  <th style="padding: 8px; text-align: center;">Cantidad</th>
                  <th style="padding: 8px; text-align: right;">Precio Unit.</th>
                  <th style="padding: 8px; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${productosHTML}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="padding: 8px; text-align: right;"><strong>Total:</strong></td>
                  <td style="padding: 8px; text-align: right;"><strong>$${formatearNumero(emailData.total)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style="text-align: center; margin-top: 20px; color: #666;">
            <p>¡Gracias por su compra!</p>
            <p style="font-size: 12px;">Este documento es válido como soporte de venta</p>
          </div>
        </div>
      `,
    };

    console.log('Intentando enviar email con:', {
      serviceId: SERVICE_ID,
      templateId: TEMPLATE_ID,
      params: templateParams
    });

    const response = await emailjs.send(
      SERVICE_ID,  // Usar el nuevo service ID
      TEMPLATE_ID,
      templateParams,
      PUBLIC_KEY
    );

    console.log('Respuesta del servidor:', response);
    return response;
  } catch (error) {
    console.error('Error completo:', error);
    throw new Error('Error al enviar el email: ' + (error.text || error.message));
  }
};
