# 3dit
Infrastructure 3D Builder

## Modèle de Données (JSON)

La scène est décrite par un fichier JSON structuré de manière hiérarchique.

### Structure Hiérarchique

1.  **Racine (Root)**
    *   `sites` (Tableau) : Conteneurs physiques principaux.
    *   `instances` (Tableau) : Serveurs virtuels ou machines.
    *   `networkdevices` (Tableau) : Équipements réseaux (Firewalls, Routeurs).
    *   `pois` (Tableau) : Points d'intérêt pour la navigation caméra.

2.  **Objets & Propriétés**

    Chaque objet partage des propriétés communes et possède des propriétés spécifiques.

    #### Propriétés Communes
    *   `name` (string) : Nom de l'objet.
    *   `class` (enum) : Type de l'objet.
    *   `style` (object) : Propriétés visuelles héritables ou spécifiques.

    #### Détail par Classe d'Objet

    **Site** (`class: "site"`)
    *   `zones` (Tableau de Zone)
    *   `style`:
        *   `childPosition` (enum: `horizontal`, `vertical`) : Disposition des zones enfants.
        *   `minWidth` (number) : Largeur minimale.

    **Zone** (`class: "zone"`)
    *   `networks` (Tableau de Network)
    *   `style`:
        *   `childPosition` (enum: `horizontal`, `vertical`) : Disposition des réseaux enfants.
        *   `minWidth` (number).

    **Network** (`class: "network"`)
    *   `network` (string) : CIDR (ex: "192.168.1.0/24").
    *   `style`:
        *   `color` (hex string) : Couleur du réseau.
        *   `maxcol` (number) : Nombre maximum de colonnes pour les IPs affichées.

    **Instance** (`class: "instance"`)
    *   `cpu` (number) : Nombre de vCPU.
    *   `ram` (number) : RAM en Mo.
    *   `os` (string) : Système d'exploitation.
    *   `storage` (number) : Stockage en Go.
    *   `interfaces` (Tableau d'Interface).
    *   `services` (Tableau de Service).

    **NetworkDevice** (`class: "firewall"`, etc.)
    *   `interfaces` (Tableau d'Interface).
    *   `style`:
        *   `position` (object) : Positionnement relatif ou absolu.

    **Interface** (`class: "interface"`)
    *   `mac` (string) : Adresse MAC.
    *   `net` (string) : Nom du réseau auquel elle est connectée (référence).
    *   `position` (enum: `direct`, `back`, `side`, `front`, `direct-back`) : Position physique du port sur l'objet.
    *   `ips` (Tableau d'IP).

    **IP** (`class: "ip"`)
    *   `ip` (string) : Adresse IP.
    *   `gateway` (string) : Passerelle.
    *   `vips` (Tableau de VRRP/BGP).

### Actions Hiérarchiques (Éditeur)

L'éditeur permet d'ajouter des objets enfants via l'inspecteur selon les règles suivantes :
*   **Site** -> Ajouter une Zone.
*   **Zone** -> Ajouter un Réseau.
*   **Instance / Firewall** -> Ajouter une Interface, Ajouter un Service.
*   **Interface** -> Ajouter une IP.

### Héritage de Style

L'objet `style` permet de définir l'apparence. Certaines propriétés sont spécifiques au conteneur (comme `childPosition` qui affecte la disposition des enfants), d'autres à l'objet lui-même (`color`, `minWidth`).

*   **Layout** : `childPosition` (`horizontal` | `vertical`) définit comment les éléments contenus sont empilés.
*   **Dimensions** : `minWidth`, `minDepth`, `minHeight` contrôlent la taille minimale de la représentation 3D.
*   **Apparence** : `color` définit la teinte de base de l'objet (souvent utilisé pour les réseaux).

### Listes de Valeurs (Enums)

*   **Classes** : `site`, `zone`, `network`, `instance`, `firewall`, `interface`, `ip`, `service`, `vrrp`, `bgp`.
*   **Layout (childPosition)** : `horizontal`, `vertical`.
*   **Port Position** : `direct` (droit), `back` (arrière), `side` (côté), `front` (avant), `direct-back`.
