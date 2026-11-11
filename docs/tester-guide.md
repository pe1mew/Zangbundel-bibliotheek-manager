# Testen van de Zangbundel bibliotheek-manager

*Voor testers. Implementatieplan M7.5, voltooiingsplan C10; regels uit de beveiligingsanalyse SR-80 tot SR-82.*

Bedankt dat je wilt testen. De bibliotheek-manager is de webapp waarmee leiding liedbibliotheken maakt, controleert, bewerkt en ondertekent voor de Zangbundel-app. Voordat een nieuwe versie naar https://zangbundel.nl gaat, proberen we hem uit op een aparte testsite.

## Waar en hoe

- **Testsite:** https://test.zangbundel.nl. Remko geeft je de gebruikersnaam en het wachtwoord.
- **Herkenbaar aan** de oranje balk bovenaan: *TESTVERSIE — niet voor echte bibliotheken of sleutels*.
- **Browser:** een computer met een recente Chrome, Edge, Firefox of Safari. Zeg bij elke melding welke browser en welk besturingssysteem je gebruikt. Op een telefoon toont de manager alleen een korte uitlegpagina; dat is zo bedoeld.
- **Handleiding:** de testsite heeft de nieuwe handleiding op https://test.zangbundel.nl/wiki/. Lees mee en meld wat onduidelijk of onjuist is.

## Alleen testbestanden

Gebruik op de testsite **geen echte bibliotheken en geen echte sleutel**. Een testversie kan fouten bevatten.

Gebruik deze bestanden uit de map `test-libraries` van het project op GitHub (https://github.com/pe1mew/Zangbundel-bibliotheek-manager/tree/main/test-libraries):

| Bestand | Wat het is |
|---|---|
| `valid-unsigned.zbl` | Een goede bibliotheek met vier liedjes en twee sets, niet ondertekend |
| `valid-signed.zbl` | Dezelfde bibliotheek, ondertekend met de testsleutel |
| `test-key-rfc8032.zbkey` | De testsleutel. Hij is openbaar, dus nooit voor iets echts te gebruiken |

De andere bestanden in die map zijn met opzet kapot: elk breekt één regel. Open er gerust een paar om te zien hoe de manager een fout uitlegt.

**Sleutel maken** mag je uitproberen. Gebruik die sleutel daarna nergens voor en gooi het bestand weg.

## Wat je kunt proberen

Je hoeft niet alles te doen. Vink af wat je gedaan hebt en meld wat je opviel.

1. **Nieuwe bibliotheek:** maak er een en vul links onder *Bibliotheek* alle verplichte velden in.
2. **Lied toevoegen:** maak een lied in *Blokken*. Schakel daarna naar *Code (ChordPro)* en terug. Vul de liedgegevens in en kies **Toepassen**.
3. **Uitleg:** klik op ⓘ naast een veld, of druk in een veld op **F1**. Werkt *Meer in de handleiding*?
4. **Sets:** maak twee of drie sets en voeg liedjes toe met + in de lijst *Liedjes*. Zet de sets in een andere volgorde: sleep ze aan de greep, of gebruik Alt+↑ en Alt+↓.
5. **Controle:** open **Controle** in de onderbalk. Probeer **Ga naar** bij een melding.
6. **Downloaden:** sla de bibliotheek op en open het bestand daarna opnieuw.
7. **Ondertekend:** open `valid-signed.zbl`. Hij opent alleen lezen. Laad `test-key-rfc8032.zbkey`; nu kun je hem wijzigen en ondertekend downloaden.
8. **Opslaan als kopie:** kies **Downloaden** en daar **Opslaan als kopie**, voor een kopie van de ondertekende bibliotheek.
9. **Met het toetsenbord:** probeer een lied toe te voegen en toe te passen zonder muis, alleen met Tab, Enter en de pijltjes.
10. **In de app (later):** de Zangbundel-app kan dit bestandsformaat nog niet importeren. Zodra een versie van de app dat kan, vragen we je een gedownloade testbibliotheek daarin te importeren.

## Iets melden

Meld wat je vindt als *issue* op GitHub: https://github.com/pe1mew/Zangbundel-bibliotheek-manager/issues. Geen GitHub-account? Stuur het dan aan Remko, zoals afgesproken.

Zet in een melding:

- wat je deed, stap voor stap;
- wat je verwachtte;
- wat er gebeurde, met een schermafbeelding als dat helpt;
- je browser en besturingssysteem;
- de versie, die je ziet onder **Over** (bijvoorbeeld 0.3.0-dev.2).

Zet geen persoonlijke gegevens, sleutelbestanden of liedteksten met auteursrecht in een melding. De testbibliotheken mag je wel bijvoegen.

## Privacy

De testsite bewaart wat elke website bewaart, ingekort en maximaal 14 dagen. Een mislukte inlogpoging komt met je gebruikersnaam in een foutlog. Je liedjes en sleutels blijven in je eigen browser. Zie de privacyverklaring onder **Over**.
