import { MediaType } from '../../lib/api'; 

// Represents a single story item for the Viewer
export interface Story {
    story_id: number;
    media_url: string;
    thumbnail_url: string | null;
    media_type: MediaType;
    created_at: string;
    admin_id: number;
    admin_name: string;
    bundle_id: string; // <--- ADDED: To track which bubble it belongs to
}

// Represents the raw data structure from the API
export interface ApiStoryGroup {
    bundle_id: string;   // <--- ADDED: The unique ID for this circle
    admin_id: number;
    admin_name: string;
    uploaded_at: string; // <--- ADDED: Timestamp of the bundle
    stories: {
        story_id: number;
        media_url: string;
        thumbnail_url: string | null;
        media_type: MediaType;
        created_at: string; // API sends string dates
    }[];
}