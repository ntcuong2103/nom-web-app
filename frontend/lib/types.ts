export type AuthToken = {
  access_token: string;
  token_type: string;
};

export type Dataset = {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_at: string;
};

export type ImageRecord = {
  id: number;
  dataset_id: number;
  filename: string;
  source_folder: string | null;
  width: number;
  height: number;
  uploaded_by: number;
  created_at: string;
};

export type AnnotationDraft = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  status: string;
};

export type Annotation = AnnotationDraft & {
  id: number;
  image_id: number;
  confidence: number | null;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
};

export type AnnotationEvent = {
  id: number;
  annotation_id: number;
  actor_user_id: number;
  actor_username: string;
  event_type: string;
  old_value_json: Record<string, unknown> | null;
  new_value_json: Record<string, unknown> | null;
  created_at: string;
};

export type ExportResult = {
  filename: string;
  download_url: string;
};

export type ReviewItem = {
  id: number;
  image_id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  status: string;
  confidence: number | null;
  image_filename: string;
  source_folder: string | null;
};

export type ReviewList = {
  items: ReviewItem[];
  total: number;
};

export type ReviewFilterParams = {
  label?: string;
  folder?: string;
  status?: string;
};

export type ReviewPreviousState = {
  id: number;
  status: string;
  label: string;
};

export type BulkReviewResult = {
  updated: number;
  previous: ReviewPreviousState[];
};
