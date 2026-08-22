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
