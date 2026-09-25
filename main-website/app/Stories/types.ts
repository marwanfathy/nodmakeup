import { MediaType } from '../../lib/api'; 

// Represents a single story item for the Viewer (camelCase wire)
export interface Story {
    id: string;
    mediaUrl: string;
    thumbnailUrl: string | null;
    mediaType: MediaType;
    createdAt: string;
    adminId: string;
    adminName: string;
    bundleId: string; // <--- ADDED: To track which bubble it belongs to
}

// Represents the raw data structure from the API (camelCase wire)
export interface ApiStoryGroup {
    bundleId: string;   // <--- ADDED: The unique ID for this circle
    adminId: string;
    adminName: string;
    uploadedAt: string; // <--- ADDED: Timestamp of the bundle
    stories: {
        id: string;
        mediaUrl: string;
        thumbnailUrl: string | null;
        mediaType: MediaType;
        createdAt: string; // API sends string dates
    }[];
}