import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Story } from './types'; 
import { markStoryAsViewed, mediaUrl } from '../../lib/api';

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

const StoryViewer: React.FC<StoryViewerProps> = ({ stories, initialIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const viewedIdsRef = useRef<Set<string>>(new Set());

    // Safety check must NOT return early — all hooks below must run every render.
    const currentStory = (stories && stories.length > 0 && currentIndex >= 0 && currentIndex < stories.length)
        ? stories[currentIndex]
        : undefined;

    // If we fall into an invalid state, ask the parent to close (in an effect, not render).
    useEffect(() => {
        if (!currentStory) onClose();
    }, [currentStory, onClose]);

    const currentBundleStories = useMemo(() => {
        if (!currentStory) return [];
        return stories.filter(s => s.bundleId === currentStory.bundleId);
    }, [stories, currentStory]);

    const fullMediaUrl = currentStory ? mediaUrl(currentStory.mediaUrl) : '';

    // Robust case-insensitive check
    const isVideo = !!currentStory && currentStory.mediaType?.toString().toUpperCase() === 'VIDEO';

    // 3. Navigation Logic
    const goToNext = useCallback(() => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose(); // End of all stories
        }
    }, [currentIndex, stories.length, onClose]);

    const goToPrev = useCallback(() => {
        // If we are at the start of a bundle, go to previous bundle's last item?
        // Or just go to previous index.
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex]);

    // 4. Handle Media Playback & Timer
    useEffect(() => {
        if (!currentStory) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset progress on story change
        setProgress(0);
        if (timerRef.current) clearTimeout(timerRef.current);

        // Mark as Viewed
        if (!viewedIdsRef.current.has(currentStory.id)) {
            markStoryAsViewed(currentStory.id)
                .then(() => {})
                .catch((err: unknown) => console.error('Failed to track view:', err));
            viewedIdsRef.current.add(currentStory.id);
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
            const nextUrl = mediaUrl(nextStory.mediaUrl);
            const isNextVideo = nextStory.mediaType?.toString().toUpperCase() === 'VIDEO';

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
    const getBarStatus = (storyId: string) => {
        // Find index of the story in the GLOBAL list
        const storyGlobalIndex = stories.findIndex(s => s.id === storyId);
        
        if (storyGlobalIndex < currentIndex) return 'completed';
        if (storyGlobalIndex === currentIndex) return 'active';
        return 'pending';
    };

    // All hooks are above — safe to bail out of rendering now.
    if (!currentStory) return null;

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
                        const status = getBarStatus(story.id);
                        let width = '0%';
                        if (status === 'completed') width = '100%';
                        else if (status === 'active') width = `${progress}%`;

                        return (
                            <div key={story.id} className="progress-segment-wrapper">
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
                            {currentStory.adminName.charAt(0)}
                        </div>
                        <div>
                            <div className="story-admin-name">{currentStory.adminName}</div>
                            <div className="story-timestamp">{timeAgo(currentStory.createdAt)}</div>
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
                            key={currentStory.id} 
                            playsInline 
                            autoPlay 
                            muted 
                            className="story-media"
                        />
                    ) : (
                        <img 
                            src={fullMediaUrl} 
                            alt={`Story by ${currentStory.adminName}`} 
                            key={currentStory.id} 
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