<?php
// Désactiver l'affichage des erreurs dans la sortie standard pour ne pas casser le JSON
ini_set('display_errors', 0);
ini_set('log_errors', 1);
header('Content-Type: application/json; charset=utf-8');

// Dossier contenant les projets
$projectDir = __DIR__ . '/projects/';

// Action demandée
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        // Liste les fichiers .json dans le dossier projects
        $files = glob($projectDir . '*.json');
        $fileList = array_map(function($file) {
            return basename($file);
        }, $files);
        echo json_encode(['files' => $fileList]);
        break;

    case 'load':
        // Charge le contenu d'un fichier spécifique
        $filename = $_GET['file'] ?? '';
        if (!$filename || !file_exists($projectDir . $filename)) {
            http_response_code(404);
            echo json_encode(['error' => 'File not found']);
            exit;
        }
        echo file_get_contents($projectDir . $filename);
        break;

    case 'save':
        // Sauvegarde le contenu dans un fichier
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $filename = $input['file'] ?? '';
        $content = $input['content'] ?? '';

        if (!$filename || !$content) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing filename or content']);
            exit;
        }

        // Validation basique du nom de fichier pour la sécurité
        if (basename($filename) !== $filename || !str_ends_with($filename, '.json')) {
             http_response_code(403);
             echo json_encode(['error' => 'Invalid filename']);
             exit;
        }

        // Validation que c'est du JSON valide
        if (is_string($content)) {
             $jsonTest = json_decode($content);
             if (json_last_error() !== JSON_ERROR_NONE) {
                  http_response_code(400);
                  echo json_encode(['error' => 'Invalid JSON content']);
                  exit;
             }
             // On écrit la chaine telle quelle
             $dataToWrite = $content;
        } else {
             // Si c'est déjà un objet/array, on l'encode
             $dataToWrite = json_encode($content, JSON_PRETTY_PRINT);
        }

        if (file_put_contents($projectDir . $filename, $dataToWrite) !== false) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save file']);
        }
        break;

    default:
        echo json_encode(['error' => 'Invalid action']);
        break;
}
