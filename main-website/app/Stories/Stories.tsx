'use client';

import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import './Stories.css';
import { Story, ApiStoryGroup } from './types';
import StoryViewer from './StoryViewer';
import { getPublicStories, mediaUrl } from '../../lib/api'; 

const Stories: React.FC = () => {
    // Stores the "Bubbles" (Groups)
    const [storyGroups, setStoryGroups] = useState<ApiStoryGroup[]>([]);
    // Stores the flat list for the Viewer to navigate through
    const [allStories, setAllStories] = useState<Story[]>([]);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
    const [currentStoryIndex, setCurrentStoryIndex] = useState<number>(0);

    useEffect(() => {
        const fetchAndProcessStories = async () => {
            try {
                const fetchedGroups: ApiStoryGroup[] = await getPublicStories();
                setStoryGroups(fetchedGroups);

                // Flatten groups into a single playlist
                // Order is preserved: Group 1 (Slides 1-3), Group 2 (Slide 1), etc.
                const flattened: Story[] = fetchedGroups.flatMap((group) =>
                    group.stories.map((story) => ({
                        ...story,
                        createdAt: story.createdAt.toString(),
                        adminId: group.adminId,
                        adminName: group.adminName,
                        bundleId: group.bundleId, // Inherit bundle ID
                    }))
                );
                setAllStories(flattened);

            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
                console.error("Failed to fetch stories:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndProcessStories();
    }, []);

    const handleGroupClick = (group: ApiStoryGroup) => {
        // Find the first story of this specific bundle in the flattened list
        const firstStoryId = group.stories[0]?.id;
        if (firstStoryId === undefined) return;

        const startIndex = allStories.findIndex(story => story.id === firstStoryId);

        if (startIndex !== -1) {
            setCurrentStoryIndex(startIndex);
            setIsViewerOpen(true);
        }
    };

    if (isLoading) {
        return <div className="stories-tray-container" style={{ paddingLeft: '16px' }}>Loading...</div>;
    }

    if (error) {
        // Optional: Hide component on error instead of showing text
        return null; 
    }

    if (storyGroups.length === 0) {
        return null;
    }

    return (
        <>  
            <div className="stories-tray-container">
                                <h1 className='title-story-section'>Events</h1><span className='title-story-section-separite'>|</span>

                <Swiper
                    className="story-swiper"
                    slidesPerView={'auto'}
                    spaceBetween={10}
                    freeMode={true}
                    centerInsufficientSlides={true}
                >
                    {storyGroups.map((group) => {
                        if (group.stories.length === 0) return null;
                        
                        // Use the first story's thumb/image as the cover for the bubble
                        const coverImage = mediaUrl(group.stories[0].thumbnailUrl || group.stories[0].mediaUrl) || '/placeholder-avatar.png';

                        return (
                            // KEY CHANGE: Use group.bundleId as key, not adminId
                            <SwiperSlide key={group.bundleId} style={{ width: '80px' }}>
                                <div className="story-avatar-wrapper" onClick={() => handleGroupClick(group)}>
                                    
                                    <div className="story-avatar">
                                        <img
                                            src={coverImage || '/placeholder-avatar.png'}
                                            alt={`Story by ${group.adminName}`}
                                            // Optional: Add a border if it's a video vs image, or just standard
                                            style={{ objectFit: 'cover' }}
                                        />
                                    </div>
                                </div>
                            </SwiperSlide>
                        );
                    })}
                </Swiper>
            </div>

            {isViewerOpen && (
                <StoryViewer
                    stories={allStories}
                    initialIndex={currentStoryIndex}
                    onClose={() => setIsViewerOpen(false)}
                />
            )}
        </>
    );
};

export default Stories;