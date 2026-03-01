# Système de Points - Pharmacien DiabCare

## Vue d'ensemble

Le système de points récompense les pharmaciens pour leur activité sur la plateforme DiabCare. Chaque action positive (traitement de commandes, ventes) rapporte des points qui permettent de monter en grade (badges).

---

## Comment gagner des points

| Action | Points | Description |
|--------|--------|-------------|
| `ORDER_CONFIRMED` | **+10** | Confirmer une commande entrante |
| `ORDER_READY` | **+5** | Marquer une commande comme prête |
| `ORDER_PICKED_UP` | **+15** | Commande récupérée par le patient |
| `PER_ITEM_SOLD` | **+5** | Par article dans une commande terminée |
| `FAST_CONFIRM_BONUS` | **+3** | Confirmer en moins de 5 minutes |
| `FIRST_ORDER_OF_DAY` | **+5** | Première commande traitée du jour |

### Milestones (Bonus cumulatifs)

| Milestone | Points bonus |
|-----------|-------------|
| 10 commandes terminées | **+50** |
| 50 commandes terminées | **+150** |
| 100 commandes terminées | **+300** |

---

## Système de Badges

Les badges sont attribués automatiquement en fonction du total de points accumulés :

| Badge | Points requis | Icône |
|-------|--------------|-------|
| 🥉 **Bronze** | 0 | Débutant |
| 🥈 **Silver** | 100 | Confirmé |
| 🥇 **Gold** | 500 | Expert |
| 💎 **Platinum** | 1 000 | Maître |
| 💠 **Diamond** | 5 000 | Légende |

Le badge se met à jour automatiquement à chaque gain de points.

---

## Cycle de vie d'une commande et points

```
[Patient passe commande]
        │
        ▼
   ┌─────────┐
   │ PENDING  │ (En attente)
   └────┬─────┘
        │
        ▼  Pharmacien confirme
   ┌──────────┐
   │ CONFIRMED│  → +10 points (ORDER_CONFIRMED)
   └────┬─────┘   → +3 bonus si < 5 min (FAST_CONFIRM)
        │          → +5 bonus si 1ère du jour
        ▼  Pharmacien prépare
   ┌────────┐
   │  READY  │  → +5 points (ORDER_READY)
   └────┬────┘
        │
        ▼  Patient récupère
   ┌──────────┐
   │ PICKED_UP│  → +15 points (ORDER_PICKED_UP)
   └──────────┘   → +5 par article vendu (PER_ITEM_SOLD)
                   → +50/150/300 si milestone atteint
```

### Exemple concret

Un pharmacien confirme une commande de 3 articles en 2 minutes (première commande du jour) :

1. **Confirmation** : +10 pts
2. **Confirmation rapide** (<5min) : +3 pts
3. **Première commande du jour** : +5 pts
4. **Commande prête** : +5 pts
5. **Commande récupérée** : +15 pts
6. **3 articles vendus** : +15 pts (3 × 5)

**Total pour cette commande : 53 points**

---

## API Endpoints

### Configuration des points
```
GET /api/orders/points/config
```
Retourne les constantes POINTS et BADGE_THRESHOLDS.

### Statistiques pharmacien
```
GET /api/orders/pharmacist/:pharmacistId/stats
```
Retourne : totalOrders, completedOrders, pendingOrders, totalRevenue.

### Profil pharmacien (inclut points et badge)
```
GET /api/pharmaciens/:id
```
Champs : `points`, `badgeLevel`, `unlockedBadges[]`.

---

## Notes techniques

- Les points sont stockés dans le champ `points` (Number) du document Pharmacien
- Le `badgeLevel` est recalculé automatiquement à chaque attribution de points
- Les statistiques (`totalRevenue`, `totalClients`) sont mises à jour en temps réel
- Le stock des produits est décrémenté atomiquement lors de la création d'une commande
- L'annulation d'une commande (uniquement en statut `pending`) restaure le stock
- Il n'y a PAS de statut "disponible/non disponible" sur les pharmaciens
