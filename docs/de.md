# Polestar

Verfolge deine Polestar-Autos in Gladys: Akku, Reichweite, Laden,
Kilometerstand und Wartung. Die Daten kommen aus der **Polestar-Cloud** (der
der Polestar-App): Die Integration braucht einen Internetzugang, und das Auto
muss online sein.

> Diese Integration wird von Polestar weder erstellt noch unterstützt. Sie nutzt
> denselben Dienst wie die Polestar-App, der sich ohne Vorankündigung ändern
> kann.

## Was du bekommst

Ein Gerät pro Auto deines Polestar-Kontos, mit diesen Werten:

| Wert                    | Einheit | Hinweis                                  |
| ----------------------- | ------- | ---------------------------------------- |
| Akku                    | %       |                                          |
| Reichweite              | km      | vom Auto geschätzt                       |
| Lädt                    | an/aus  | an, solange das Auto lädt                |
| Zeit bis voll           | Minuten | während des Ladens                       |
| Kilometerstand          | km      |                                          |
| Tage bis zur Wartung    | Tage    | negativ, wenn die Wartung überfällig ist |
| Strecke bis zur Wartung | km      | negativ, wenn die Wartung überfällig ist |

Alles ist **nur lesend**: Polestar gibt Fernbefehle (Verriegeln, Klima, Laden)
nicht für Dritte frei.

## Konfiguration

1. Öffne den Reiter **Konfiguration** der Integration.
2. Gib die **E-Mail** und das **Passwort** deines **Polestar-ID**-Kontos ein,
   das du in der Polestar-App nutzt.
3. Optional: Gib unter **Zu verfolgende Autos (FIN)** die FINs mit Kommas
   getrennt an. Leer bedeutet alle Autos des Kontos.
4. **Aktualisierungsintervall**: wie oft jedes Auto gelesen wird, in Sekunden
   (standardmäßig 5 Minuten, mindestens 2 Minuten). Das Auto meldet sich nur
   alle paar Minuten: Kürzer bringt nichts.
5. **Schwelle für niedrigen Akku**: der Wert, unter dem der Szenen-Auslöser
   „Akku niedrig“ ausgelöst wird (standardmäßig 20 %).
6. Speichere: Deine Autos erscheinen im Reiter **Entdecken** und können
   hinzugefügt werden.

Der Knopf **Verbindung testen** meldet sich an und listet die gefundenen Autos.

Lehnt Polestar ID das Passwort ab, zeigt die Integration das an und **hört auf
zu versuchen**, bis du die Konfiguration erneut speicherst: Wiederholte
Versuche mit einem falschen Passwort könnten dein Konto sperren.

## Szenen

Die Integration fügt dem Szenen-Editor eigene Karten hinzu (Gladys 5.1 oder
neuer), in der Kategorie **Integrationen**. Jeder Auslöser kann auf ein Auto
beschränkt werden.

- **Laden gestartet** (Auslöser) — ein Auto hat mit dem Laden begonnen.
  Variablen: Auto, Akku (%), Reichweite (km).
- **Laden beendet** (Auslöser) — ein Auto lädt nicht mehr: voll, abgesteckt
  oder pausiert. Die Variable `completed` zeigt einen vollständigen
  Ladevorgang an.
- **Akku niedrig** (Auslöser) — der Akku ist unter die eingestellte Schwelle
  gefallen. Wird einmal pro Unterschreitung ausgelöst, nicht bei jeder
  Aktualisierung.
- **Wartung nötig** (Auslöser) — die Wartung wird dringender: bald, fällig,
  dann überfällig. Optional nach Dringlichkeit filtern.
- **Polestar jetzt auslesen** (Aktion) — liest das Auto sofort und gibt seine
  Werte (Akku, Reichweite, Laden, Kilometerstand, Wartung) an die nächsten
  Aktionen der Szene weiter, zum Beispiel, um dir die Reichweite zu schicken.

Die Auslöser vergleichen jede Messung mit der vorherigen: Die erste Messung
nach einem Neustart von Gladys löst nichts aus.

## Dashboard

Füge das Widget **Polestar-Auto** zu einem Dashboard hinzu und wähle in den
Einstellungen ein Auto aus. Es zeigt Akku, Reichweite und Kilometerstand live,
den Ladezustand (mit der Zeit bis voll), die Wartung, die Füllstände und die
Zeit der letzten Meldung des Autos. Der Knopf **Aktualisieren** liest das Auto
sofort.

## Cloud-Badge

Die Integration ist als **cloud** gekennzeichnet: Jedes Auto zeigt ein
**Cloud**-Badge, solange die Polestar-Cloud antwortet, und **nicht erreichbar**
sonst.

## Fehlerbehebung

- **„Polestar ID hat E-Mail oder Passwort abgelehnt“**: Melde dich mit
  derselben E-Mail und demselben Passwort in der Polestar-App an und speichere
  die Konfiguration erneut.
- **Kein Wert**: Das Auto sendet nur Daten, wenn es online ist. Öffne die
  Polestar-App: Zeigt sie auch keine aktuellen Daten, kann die Integration
  keine haben.
- **Logs**: Sieh dir die Logs der Integration in der Gladys-Oberfläche an
  (oder `docker logs` auf dem Host). Setze `LOG_LEVEL=debug` am Container für
  mehr Details. Passwort und Tokens werden nie in die Logs geschrieben.
