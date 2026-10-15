const PLACEHOLDER = '[COMPLETAR: razón social / CUIT / domicilio / email de contacto]';

function Todo() {
  return <p className="todo">{PLACEHOLDER}</p>;
}

export function Terms() {
  return (
    <article className="legal-doc">
      <span className="kick"><i />Legal</span>
      <h1 className="h2">Términos y condiciones</h1>
      <p className="lead">Borrador para un servicio de suscripción ofrecido en Argentina. Los datos del prestador todavía no están cargados.</p>
      <Todo />
      <h2>Quién presta el servicio</h2>
      <p>iManager es un software de gestión para tiendas de celulares. Lo presta {PLACEHOLDER}. Hasta que esos datos estén completos, este texto es un borrador y no reemplaza el asesoramiento de un abogado.</p>
      <h2>El servicio</h2>
      <p>La app permite llevar inventario por IMEI, ventas, canjes, clientes, caja y el resto de las funciones descriptas en esta web, según el plan elegido. El servicio se usa desde el navegador, en la computadora o en el celular.</p>
      <h2>Cuenta y prueba</h2>
      <p>Podés crear una cuenta con tu mail o con Google y probarla 7 días gratis, sin tarjeta. Al terminar la prueba, el servicio sigue si contratás un plan. Si no lo contratás, no se te cobra.</p>
      <h2>Planes y pago</h2>
      <p>Los precios publicados en esta web son los vigentes al momento de contratar. El plan Sistema propio se cotiza aparte. La facturación y el medio de pago se informan antes de confirmar la contratación. No se debitan cargos que no te hayamos mostrado.</p>
      <h2>Cancelación y arrepentimiento</h2>
      <p>Podés cancelar la suscripción cuando quieras, desde la cuenta o escribiendo a {PLACEHOLDER}. La cancelación evita el próximo cobro. Lo ya abonado del período en curso no se devuelve, salvo que la ley disponga otra cosa.</p>
      <p>Si contratás a distancia como consumidor, tenés el derecho de arrepentimiento de la Ley 24.240 de Defensa del Consumidor: dentro de los 10 días corridos de contratado podés dejarlo sin cargo, por el mismo medio en que lo contrataste o por {PLACEHOLDER}. El botón de arrepentimiento va a publicarse en [COMPLETAR: url del botón de arrepentimiento].</p>
      <h2>Uso de la cuenta</h2>
      <p>La cuenta es de la tienda que la crea. Cada plan indica cuántas personas pueden usarla. Vos cargás los datos de tu negocio (equipos, clientes, ventas) y respondés por tener derecho a usarlos. No uses el servicio para una actividad ilícita.</p>
      <h2>Disponibilidad</h2>
      <p>Trabajamos para que el servicio esté disponible, pero puede haber cortes por mantenimiento o por fallas de terceros. No prometemos un resultado económico de tu tienda.</p>
      <h2>Cambios</h2>
      <p>Si cambiamos estos términos de un modo que te afecte, lo avisamos en la app o por mail antes de que rijan. Si no estás de acuerdo, podés cancelar.</p>
      <h2>Ley aplicable</h2>
      <p>Estos términos se rigen por la ley argentina. Si sos consumidor, podés reclamar ante las autoridades de defensa del consumidor y ante los tribunales de tu domicilio.</p>
    </article>
  );
}

export function Privacy() {
  return (
    <article className="legal-doc">
      <span className="kick"><i />Legal</span>
      <h1 className="h2">Política de privacidad</h1>
      <p className="lead">Cómo trata iManager los datos personales, según la Ley 25.326. Los datos del responsable todavía no están cargados.</p>
      <Todo />
      <h2>Responsable</h2>
      <p>El responsable del tratamiento es {PLACEHOLDER}. Para ejercer tus derechos escribinos a esa dirección de contacto.</p>
      <h2>Qué datos hay</h2>
      <p>De quien crea la cuenta: nombre, mail y los datos que pide el registro (mail o cuenta de Google). De la tienda: lo que el negocio carga para operar, como equipos e IMEI, ventas, clientes, canjes y movimientos de caja.</p>
      <p>Esos datos de clientes y equipos los carga la tienda. La tienda es quien decide cargarlos; iManager los procesa para prestar el servicio.</p>
      <h2>Para qué se usan</h2>
      <p>Para crear y administrar la cuenta, prestar las funciones del plan, cobrar la suscripción, dar soporte y cumplir obligaciones legales. No vendemos datos personales ni los usamos para publicidad de terceros.</p>
      <h2>Quién puede verlos</h2>
      <p>Cada tienda ve los datos de su propia cuenta. Las personas con acceso son las que la tienda invita, según el plan. También pueden verlos los proveedores que alojan el servicio, solo para operarlo, y una autoridad si la ley lo exige.</p>
      <h2>Tus derechos</h2>
      <p>La Ley 25.326 de Protección de Datos Personales te da derecho a acceder, rectificar, actualizar y suprimir tus datos, y a pedir que te expliquemos qué tenemos. Podés hacerlo escribiendo a {PLACEHOLDER}. También podés reclamar ante la Agencia de Acceso a la Información Pública (AAIP).</p>
      <p>La supresión alcanza a los datos de la cuenta. La tienda puede tener que conservar algunos registros el tiempo que le exija la ley fiscal o comercial.</p>
      <h2>Esta web</h2>
      <p>La web de marketing no te pide una cuenta. No usa cookies de seguimiento de terceros. La app, en app.imanager.com.ar, usa la sesión necesaria para que entres a tu tienda.</p>
      <h2>Cambios</h2>
      <p>Si cambiamos esta política, publicamos la versión nueva en esta página.</p>
    </article>
  );
}

export function NotFound() {
  return (
    <article className="legal-doc">
      <span className="kick"><i />404</span>
      <h1 className="h2">Esta página no existe.</h1>
      <p className="lead">El enlace no lleva a ninguna parte de iManager.</p>
      <p><a className="btn p" href="/">Volver al inicio</a></p>
    </article>
  );
}
