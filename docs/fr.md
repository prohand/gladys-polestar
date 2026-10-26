# Polestar

Suivez vos voitures Polestar dans Gladys : batterie, autonomie, charge,
kilométrage et entretien. Les données viennent du **cloud Polestar** (celui de
l'application Polestar) : l'intégration a besoin d'un accès internet, et la
voiture doit être en ligne.

> Cette intégration n'est ni faite ni soutenue par Polestar. Elle utilise le
> même service que l'application Polestar, qui peut changer sans prévenir.

## Ce que vous obtenez

Un appareil par voiture de votre compte Polestar, avec ces valeurs :

| Valeur                   | Unité   | Remarque                                |
| ------------------------ | ------- | --------------------------------------- |
| Batterie                 | %       |                                         |
| Autonomie                | km      | estimée par la voiture                  |
| En charge                | oui/non | oui pendant que la voiture charge       |
| Temps avant charge       | minutes | pendant la charge                       |
| Compteur                 | km      |                                         |
| Jours avant entretien    | jours   | négatif quand l'entretien est en retard |
| Distance avant entretien | km      | négatif quand l'entretien est en retard |

Tout est en **lecture seule** : Polestar n'ouvre pas les commandes à distance
(verrouillage, climatisation, charge) aux applications tierces.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Renseignez l'**e-mail** et le **mot de passe** de votre compte
   **Polestar ID**, celui de l'application Polestar.
3. Facultatif : dans **Voitures à suivre (VIN)**, listez les VIN à suivre,
   séparés par des virgules. Vide = toutes les voitures du compte.
4. **Intervalle de rafraîchissement** : fréquence de lecture de chaque
   voiture, en secondes (5 minutes par défaut, 2 minutes minimum). La voiture
   ne se signale que toutes les quelques minutes : plus court n'apporte rien.
5. **Seuil de batterie faible** : le niveau sous lequel le déclencheur de
   scène « Batterie faible » se lance (20 % par défaut).
6. Enregistrez : vos voitures apparaissent dans l'onglet **Découverte**, prêtes
   à être ajoutées.

Le bouton **Tester la connexion** se connecte et liste les voitures trouvées.

Si Polestar ID refuse le mot de passe, l'intégration l'indique et **arrête
d'essayer** jusqu'au prochain enregistrement de la configuration : des
essais répétés avec un mauvais mot de passe pourraient bloquer votre compte.

## Scènes

L'intégration ajoute ses propres cartes dans l'éditeur de scènes (Gladys 5.1
ou plus), dans la catégorie **Intégrations**. Chaque déclencheur peut être
limité à une voiture.

- **Charge démarrée** (déclencheur) — une voiture a commencé à charger.
  Variables : voiture, batterie (%), autonomie (km).
- **Charge arrêtée** (déclencheur) — une voiture a arrêté de charger : charge
  terminée, débranchée ou en pause. La variable `completed` indique une
  charge terminée.
- **Batterie faible** (déclencheur) — la batterie est passée sous le seuil de
  la configuration. Se lance une fois par passage, pas à chaque
  rafraîchissement.
- **Entretien à prévoir** (déclencheur) — l'entretien devient plus urgent :
  bientôt, à faire, puis en retard. Filtre possible sur l'urgence.
- **Lire une Polestar maintenant** (action) — lit la voiture tout de suite et
  donne ses valeurs (batterie, autonomie, charge, compteur, entretien) aux
  actions suivantes de la scène, par exemple pour vous envoyer un message
  avec l'autonomie.

Les déclencheurs comparent chaque lecture à la précédente : la première
lecture après un redémarrage de Gladys ne déclenche rien.

## Tableau de bord

Ajoutez le widget **Voiture Polestar** à un tableau de bord et choisissez une
voiture dans ses réglages. Il affiche en direct la batterie, l'autonomie et le
compteur, l'état de charge (avec le temps avant charge complète), l'entretien,
les niveaux et l'heure du dernier relevé de la voiture. Son bouton
**Actualiser** lit la voiture tout de suite.

## Badge cloud

L'intégration est marquée **cloud** : chaque voiture affiche un badge
**cloud** tant que le cloud Polestar répond, et **injoignable** sinon.

## En cas de problème

- **« Polestar ID a refusé l'e-mail ou le mot de passe »** : connectez-vous à
  l'application Polestar avec le même e-mail et mot de passe, puis
  enregistrez à nouveau la configuration.
- **Aucune valeur** : la voiture n'envoie ses données que lorsqu'elle est en
  ligne. Ouvrez l'application Polestar : si elle n'a pas de données récentes
  non plus, l'intégration ne peut pas en avoir.
- **Logs** : consultez les logs de l'intégration depuis l'interface de Gladys
  (ou `docker logs` sur l'hôte). Mettez `LOG_LEVEL=debug` sur le conteneur
  pour plus de détails. Le mot de passe et les jetons ne sont jamais écrits
  dans les logs.
