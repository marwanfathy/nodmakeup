import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Story } from './types'; 
import { MediaType, markStoryAsViewed } from '../../lib/api';

// --- Helper Function ---
const timeAgo = (date: string): string => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)}y`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)}mo`;
    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)}d`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)}h`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)}m`;
    return `${Math.floor(seconds)}s`;
};

interface StoryViewerProps {
    stories: Story[];       // The flattened list of ALL stories (so we can auto-play to next user)
    initialIndex: number;   // Where to start
    onClose: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

const StoryViewer: React.FC<StoryViewerProps> = ({ stories, initialIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const viewedIdsRef = useRef<Set<number>>(new Set());

    // 1. Safety Check
    if (!stories || stories.length === 0 || currentIndex >= stories.length) {
        onClose();
        return null;
    }

    const currentStory = stories[currentIndex];

    // 2. KEY FIX: Filter stories to get only the current BUNDLE (Group)
    // We use useMemo so this doesn't run on every timer tick, only when the index changes bundle
    const currentBundleStories = useMemo(() => {
        return stories.filter(s => s.bundle_id === currentStory.bundle_id);
    }, [stories, currentStory.bundle_id]);

    const fullMediaUrl = currentStory.media_url.startsWith('http')
        ? currentStory.media_url
        : `${API_BASE_URL}${currentStory.media_url}`;

    // Robust case-insensitive check
    const isVideo = currentStory.media_type?.toString().toUpperCase() === 'VIDEO';

    // 3. Navigation Logic
    const goToNext = useCallback(() => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose(); // End of all stories
        }
    }, [currentIndex, stories.length, onClose]);

    const goToPrev = () => {
        // If we are at the start of a bundle, go to previous bundle's last item?
        // Or just go to previous index.
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    // 4. Handle Media Playback & Timer
    useEffect(() => {
        setProgress(0);
        if (timerRef.current) clearTimeout(timerRef.current);

        // Mark as Viewed
        if (!viewedIdsRef.current.has(currentStory.story_id)) {
            markStoryAsViewed(currentStory.story_id)
                .then(() => {})
                .catch((err: any) => console.error('Failed to track view:', err));
            viewedIdsRef.current.add(currentStory.story_id);
        }

        if (isPaused) return;

        if (isVideo) { 
            const video = videoRef.current;
            if (!video) return;

            const onTimeUpdate = () => {
                if (video.duration) {
                    setProgress((video.currentTime / video.duration) * 100);
                }
            };
            const onEnded = () => goToNext();

            video.currentTime = 0;
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => { /* Auto-play blocked handling */ });
            }

            video.addEventListener('timeupdate', onTimeUpdate);
            video.addEventListener('ended', onEnded);
            return () => {
                video.removeEventListener('timeupdate', onTimeUpdate);
                video.removeEventListener('ended', onEnded);
            };
        } else { 
            // IMAGE
            const DURATION = 5000; // 5 Seconds per image
            const startTime = Date.now();
            
            const update = () => {
                const elapsed = Date.now() - startTime;
                if (elapsed >= DURATION) {
                    goToNext();
                } else {
                    setProgress((elapsed / DURATION) * 100);
                    timerRef.current = setTimeout(update, 50);
                }
            };
            timerRef.current = setTimeout(update, 50);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [currentIndex, isPaused, currentStory, goToNext, isVideo]);

    // 5. User Interaction Controls
    const handleInteractionStart = () => {
        setIsPaused(true);
        if (videoRef.current) videoRef.current.pause();
    };
    const handleInteractionEnd = () => {
        setIsPaused(false);
        if (videoRef.current) videoRef.current.play().catch(() => {});
    };

    // 6. Preload Next Story (Performance)
    useEffect(() => {
        const nextStory = stories[currentIndex + 1];
        if (nextStory) {
            const nextUrl = nextStory.media_url.startsWith('http') 
                ? nextStory.media_url 
                : `${API_BASE_URL}${nextStory.media_url}`;
            const isNextVideo = nextStory.media_type?.toString().toUpperCase() === 'VIDEO';

            if (isNextVideo) {
                const vid = document.createElement('video');
                vid.src = nextUrl;
                vid.preload = 'auto';
            } else {
                const img = new Image();
                img.src = nextUrl;
            }
        }
    }, [currentIndex, stories]);

    // 7. Render Helper: Calculate status of a bar in the current bundle
    const getBarStatus = (storyId: number) => {
        // Find index of the story in the GLOBAL list
        const storyGlobalIndex = stories.findIndex(s => s.story_id === storyId);
        
        if (storyGlobalIndex < currentIndex) return 'completed';
        if (storyGlobalIndex === currentIndex) return 'active';
        return 'pending';
    };

    return (
        <div 
            className="story-overlay" 
            onMouseDown={handleInteractionStart} 
            onMouseUp={handleInteractionEnd} 
            onTouchStart={handleInteractionStart} 
            onTouchEnd={handleInteractionEnd}
        >
            <div className="story-viewer">
                
                {/* --- PROGRESS BARS (Scoped to Current Bundle) --- */}
                <div className="progress-bar-container">
                    {currentBundleStories.map((story) => {
                        const status = getBarStatus(story.story_id);
                        let width = '0%';
                        if (status === 'completed') width = '100%';
                        else if (status === 'active') width = `${progress}%`;

                        return (
                            <div key={story.story_id} className="progress-segment-wrapper">
                                <div 
                                    className="progress-segment-fill" 
                                    style={{ width }} 
                                />
                            </div>
                        );
                    })}
                </div>

                {/* --- HEADER --- */}
                <div className="story-header">
                    <div className="story-header-info">
                        <div className="story-avatar-placeholder">
                            {currentStory.admin_name.charAt(0)}
                        </div>
                        <div>
                            <div className="story-admin-name">{currentStory.admin_name}</div>
                            <div className="story-timestamp">{timeAgo(currentStory.created_at)}</div>
                        </div>
                    </div>
                    <button className="close-story-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}>&times;</button>
                </div>

                {/* --- CONTENT --- */}
                <div className="story-content">
                    {isVideo ? (
                        <video 
                            ref={videoRef} 
                            src={fullMediaUrl} 
                            key={currentStory.story_id} 
                            playsInline 
                            autoPlay 
                            muted 
                            className="story-media"
                        />
                    ) : (
                        <img 
                            src={fullMediaUrl} 
                            alt={`Story by ${currentStory.admin_name}`} 
                            key={currentStory.story_id} 
                            className="story-media"
                        />
                    )}
                </div>

                {/* --- TAP ZONES --- */}
                <div className="story-nav-overlay prev" onClick={(e) => { e.stopPropagation(); goToPrev(); }} />
                <div className="story-nav-overlay next" onClick={(e) => { e.stopPropagation(); goToNext(); }} />
                
                {isPaused && <div className="story-pause-indicator">❚❚</div>}
            </div>
        </div>
    );
};

export default StoryViewer;