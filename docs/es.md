# Polestar

Siga sus coches Polestar en Gladys: batería, autonomía, carga, kilometraje y
mantenimiento. Los datos vienen de la **nube de Polestar** (la de la app
Polestar): la integración necesita acceso a internet y el coche debe estar en
línea.

> Esta integración no está hecha ni soportada por Polestar. Usa el mismo
> servicio que la app Polestar, que puede cambiar sin aviso.

## Lo que obtiene

Un dispositivo por coche de su cuenta Polestar, con estos valores:

| Valor                            | Unidad  | Nota                                       |
| -------------------------------- | ------- | ------------------------------------------ |
| Batería                          | %       |                                            |
| Autonomía                        | km      | estimada por el coche                      |
| Cargando                         | sí/no   | sí mientras el coche carga                 |
| Tiempo hasta carga completa      | minutos | durante la carga                           |
| Odómetro                         | km      |                                            |
| Días hasta el mantenimiento      | días    | negativo si el mantenimiento está atrasado |
| Distancia hasta el mantenimiento | km      | negativo si el mantenimiento está atrasado |

Todo es de **solo lectura**: Polestar no abre los comandos a distancia
(cierre, climatización, carga) a terceros.

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. Introduzca el **correo** y la **contraseña** de su cuenta **Polestar ID**,
   la que usa en la app Polestar.
3. Opcional: en **Coches a seguir (VIN)**, indique los VIN a seguir,
   separados por comas. Vacío significa todos los coches de la cuenta.
4. **Intervalo de actualización**: con qué frecuencia se lee cada coche, en
   segundos (5 minutos por defecto, 2 minutos como mínimo). El coche solo
   envía datos cada pocos minutos: un intervalo más corto no aporta nada.
5. **Umbral de batería baja**: el nivel bajo el cual se activa el disparador
   de escena «Batería baja» (20 % por defecto).
6. Guarde: sus coches aparecen en la pestaña **Descubrimiento**, listos para
   añadirse.

El botón **Probar la conexión** inicia sesión y lista los coches encontrados.

Si Polestar ID rechaza la contraseña, la integración lo indica y **deja de
intentarlo** hasta que vuelva a guardar la configuración: intentos repetidos
con una contraseña errónea podrían bloquear su cuenta.

## Escenas

La integración añade sus propias tarjetas al editor de escenas (Gladys 5.1 o
posterior), en la categoría **Integraciones**. Cada disparador puede limitarse
a un coche.

- **Carga iniciada** (disparador) — un coche empezó a cargar. Variables:
  coche, batería (%), autonomía (km).
- **Carga detenida** (disparador) — un coche dejó de cargar: carga completa,
  desenchufado o en pausa. La variable `completed` indica una carga completa.
- **Batería baja** (disparador) — la batería bajó del umbral de la
  configuración. Se activa una vez por cruce, no en cada actualización.
- **Mantenimiento necesario** (disparador) — el mantenimiento es más urgente:
  pronto, necesario y luego atrasado. Filtro opcional por urgencia.
- **Leer un Polestar ahora** (acción) — lee el coche al momento y pasa sus
  valores (batería, autonomía, carga, odómetro, mantenimiento) a las acciones
  siguientes de la escena, por ejemplo para enviarle un mensaje con la
  autonomía.

Los disparadores comparan cada lectura con la anterior: la primera lectura
tras un reinicio de Gladys no activa nada.

## Panel

Añada el widget **Coche Polestar** a un panel y elija un coche en sus ajustes.
Muestra en directo la batería, la autonomía y el odómetro, el estado de carga
(con el tiempo hasta carga completa), el mantenimiento, los niveles y la hora
del último dato del coche. Su botón **Actualizar** lee el coche al momento.

## Insignia cloud

La integración está marcada como **cloud**: cada coche muestra una insignia
**cloud** mientras la nube de Polestar responde, e **inalcanzable** si no.

## Solución de problemas

- **«Polestar ID rechazó el correo o la contraseña»**: inicie sesión en la app
  Polestar con el mismo correo y contraseña, y vuelva a guardar la
  configuración.
- **Ningún valor**: el coche solo envía datos cuando está en línea. Abra la app
  Polestar: si tampoco muestra datos recientes, la integración no puede
  tenerlos.
- **Logs**: consulte los logs de la integración desde la interfaz de Gladys (o
  `docker logs` en el host). Ponga `LOG_LEVEL=debug` en el contenedor para más
  detalle. La contraseña y los tokens nunca se escriben en los logs.
