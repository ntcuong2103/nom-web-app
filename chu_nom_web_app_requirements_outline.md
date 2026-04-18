# Web App Requirements Outline

## 1. Project Overview

### 1.1 Purpose
Design a web-based system for Chu Nom character annotation and recognition that supports:
- automated labeling at character level
- manual annotation editing and correction
- character recognition through API services
- character detection through API services
- import/export of annotation data in YOLO format
- search and retrieval of annotated data
- clustering for dataset exploration and curation

### 1.2 Goals
- accelerate creation of high-quality Chu Nom annotated datasets
- reduce manual annotation effort through automation-assisted workflows
- support iterative correction and quality control
- provide reusable APIs for integration with OCR and research pipelines
- enable exploration of large datasets through search and clustering

### 1.3 Target Users
- annotation staff
- linguistics and digital humanities researchers
- computer vision / OCR researchers
- dataset managers and administrators
- students working on Chu Nom OCR projects

### 1.4 Scope
In scope:
- image upload and dataset management
- character-level bounding box annotation
- character label assignment and correction
- assisted annotation using detection and recognition APIs
- import/export in YOLO-compatible format
- search by image, label, metadata, and annotation status
- clustering of characters or cropped regions for discovery and cleanup
- user and role management
- audit trail and quality review workflow

Out of scope for first version:
- sentence-level or page-level semantic translation
- full manuscript transcription pipeline
- mobile-first annotation workflow
- handwriting generation or synthetic data generation

---

## 2. Functional Requirements

### 2.1 User and Access Management
- user login/logout
- role-based access control
- user roles: Admin, Annotator (Editor), and User (Viewer)
- profile management
- activity logging

### 2.2 Dataset Management
- create, edit, archive, and delete datasets
- organize datasets by collection, source, period, or document type
- upload single images or batch uploads
- support metadata fields such as source, page number, date, document title, contributor
- dataset versioning
- dataset statistics dashboard
- dataset download (images, metadata, latest annotations)

### 2.3 Annotation Workspace
- display image with zoom, pan, and fit-to-screen
- draw, resize, move, and delete character-level bounding boxes
- assign Chu Nom labels to each box
- keyboard shortcuts for fast annotation
- multi-select and bulk edit 
- undo/redo
- annotation status tags such as Unlabeled, Auto-labeled, Reviewed, Approved
- comment or note per annotation

### 2.4 Automated Labeling
- invoke detection API to propose character bounding boxes
- invoke recognition API to suggest character labels
- confidence score display for suggested labels
- batch auto-labeling for selected dataset or pages
- threshold configuration for auto-accept suggestions
- fallback behavior when confidence is low

### 2.5 Annotation Review and Quality Control
- reviewer queue for completed annotations
- compare auto-generated vs human-corrected labels
- approve/reject annotations
- flag uncertain or ambiguous characters
- track inter-annotator disagreement
- measure annotation accuracy and correction rates
- maintain full audit history of edits

### 2.6 Detection API
- endpoint to submit image and return detected character regions
- response includes bounding boxes, confidence scores, model version, processing time
- support batch inference
- support asynchronous processing for large jobs if needed
- error handling and retry behavior
- API authentication and rate limits

### 2.7 Recognition API
- endpoint to submit image crop or bounding box region and return predicted Chu Nom character label
- response includes top-k predictions, confidence scores, model version, processing time
- optional combined endpoint for detection + recognition
- support batch recognition on multiple crops
- API authentication and rate limits

### 2.8 Import and Export
- import annotations in YOLO format
- export annotations in YOLO format
- validate imported files and report errors
- map class IDs to Chu Nom characters or label dictionary
- support import/export of images plus labels as packaged archive
- preserve metadata where possible
- optionally support additional formats in future such as COCO, Pascal VOC, CSV, JSON

### 2.9 Search and Retrieval
- search by character label
- search by image name, dataset name, source, metadata fields
- search by annotation status
- search by reviewer / annotator
- search by confidence threshold or error flags
- filter by model version or import batch
- result preview with image snippets and matched boxes

### 2.10 Clustering and Dataset Exploration
- cluster character crops based on visual similarity
- cluster by embedding generated from recognition model or feature extractor
- browse clusters to identify mislabeled samples, duplicates, or rare variants
- merge/split clusters
- assign labels to whole cluster or selected items
- visualize representative samples per cluster
- allow export of cluster members

### 2.11 Reporting and Analytics
- total images, annotations, labeled characters, reviewed characters
- per-class distribution
- low-confidence annotation report
- most corrected labels
- annotator productivity metrics
- dataset completeness metrics
- cluster purity / noise indicators if available

---

## 3. Non-Functional Requirements

### 3.1 Performance
- responsive annotation UI for high-resolution manuscript images
- low-latency API calls for interactive use
- scalable batch processing for large datasets

### 3.2 Reliability
- autosave annotation changes
- recover unsaved work after interruption
- stable import/export pipeline with validation
- logging and monitoring for APIs and background jobs

### 3.3 Usability
- intuitive annotation interface for expert and non-expert users
- efficient keyboard-driven workflow
- clear confidence and review indicators
- support for large zoom levels and detailed image inspection

### 3.4 Security
- authenticated access
- authorization by dataset and role
- secure API access
- audit logs for changes
- backup and disaster recovery strategy

### 3.5 Maintainability
- modular frontend/backend design
- model services decoupled via APIs

### 3.6 Extensibility
- support adding new annotation formats
- support replacing detection/recognition models
- support advanced retrieval and active learning later

---

## 4. Data Requirements

### 4.1 Core Entities
- User
- Role
- Dataset
- Image
- Annotation
- Label Dictionary
- Review Record
- Model Prediction
- Cluster


### 4.2 Annotation Data Fields
- annotation ID
- image ID
- bounding box coordinates
- character label
- label ID / class ID
- confidence score
- annotation source (manual / auto / imported)
- status
- annotator
- reviewer
- timestamps
- notes

### 4.3 Label Dictionary
- Unicode character if available
- Chu Nom symbol reference
- canonical label name
- alternate forms / variants
- class ID mapping for YOLO export
- optional phonetic or semantic metadata

---

## 5. User Roles and Permissions

### 5.1 Admin
- manage users and permissions
- manage datasets and system settings
- configure APIs and model versions
- access all reports and audit logs

### 5.2 Annotator / Editor
- upload images if allowed
- create and edit annotations
- run auto-labeling on assigned data
- submit annotations for review

### 5.4 Researcher / Viewer
- search, browse, export approved data
- use clustering and analytics tools
- call inference APIs

---

## 6. Workflow Requirements

### 6.1 Annotation Workflow
1. user creates or selects dataset
2. user uploads images
3. system optionally runs detection and recognition
4. annotator edits/corrects proposed annotations
5. annotations become exportable and searchable

### 6.2 Import Workflow
1. user selects dataset
2. user uploads YOLO labels and related images
3. system validates file structure and label mapping
4. system imports annotations and generates import report
5. user reviews imported samples

### 6.3 Clustering Workflow
1. system generates feature embeddings for crops
2. system groups similar samples into clusters
3. user browses clusters
4. user relabels or confirms samples in bulk
5. system updates dataset and cluster statistics

---

## 7. API Requirements

### 7.1 Internal / External APIs
- authentication API
- dataset management API
- annotation CRUD API
- search API
- clustering API
- detection inference API
- recognition inference API
- import/export job API
- import/export dataset API
- import/export annotation API


### 7.2 API Design Considerations
- RESTful design for core operations
- async job endpoints for long-running tasks
- standardized response schema
- pagination, filtering, sorting
- versioning for model APIs and data APIs
- OpenAPI / Swagger documentation

---

## 8. UI Modules

### 8.1 Main Screens
- login page
- dashboard
- dataset list and dataset detail page
- image browser
- annotation editor
- review queue
- search page
- clustering page
- reports page
- admin settings page

### 8.2 Annotation Editor Components
- image viewer canvas
- annotation side panel
- label selector
- prediction/confidence panel
- metadata panel
- history / comments panel
- toolbar with shortcuts and actions

---

## 9. Integration Requirements

- object detection model service
- OCR / recognizer model service
- storage for images and annotation files
- relational database for metadata and annotations
- optional vector database for embedding search and clustering
- background job queue for batch inference, imports, exports, clustering

---

## 10. Deployment and Operations

- web frontend deployment
- backend service deployment
- model inference service deployment
- database and file storage setup
- monitoring and logging
- backup strategy
- environment separation: dev, staging, production

---

## 11. Success Criteria

- reduced annotation time per image
- increased annotation consistency
- acceptable detection and recognition accuracy
- successful YOLO import/export roundtrip
- fast retrieval of annotations and images
- useful clustering for error discovery and dataset cleanup

---

## 12. Answered Questions

- annotation shape for character: axis-aligned boxes
- what is the source of Chu Nom label vocabulary and class mapping?
recognition API return the character code
- is recognition single-character only, or should it support ligatures / compound forms?
single-character only
- should clustering be offline batch only, or interactive?
offline batch
- what volume of images and annotations must the system support?
hundred thousand pages
- what review policy is needed: single review or multi-review consensus?
no review needed, audit of annotation edit is ok
- should the first version support only YOLO, or also COCO/JSON export?
YOLO
---

## 13. Suggested Next Step

Refine this outline into:
1. product requirements document (PRD)
2. system architecture
3. database schema
4. API specification
5. user stories and backlog

