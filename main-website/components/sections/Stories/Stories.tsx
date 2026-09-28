'use client';

import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import Image from 'next/image';
import 'swiper/css';
import './Stories.css';
import { Story, ApiStoryGroup } from './types';
import StoryViewer from './StoryViewer';
import { getPublicStories, mediaUrl } from '../../../lib/api'; 
import { useI18n } from '../../../lib/i18n/client'; 

interface StoriesProps {
    /**
     * The story bundles, already resolved on the server (see app/page.js).
     * `null` means the server could not load them, and the browser fetches for
     * itself exactly as it always did.
     */
    initialGroups?: ApiStoryGroup[] | null;
}

/**
 * Flatten the bundles into the single playlist the viewer walks through.
 * Order is preserved: Group 1 (Slides 1-3), Group 2 (Slide 1), etc.
 */
const flattenGroups = (groups: ApiStoryGroup[]): Story[] =>
    groups.flatMap((group) =>
        group.stories.map((story) => ({
            ...story,
            createdAt: story.createdAt.toString(),
            adminId: group.adminId,
            adminName: group.adminName,
            bundleId: group.bundleId, // Inherit bundle ID
        }))
    );

const Stories: React.FC<StoriesProps> = ({ initialGroups = null }) => {
    const { t } = useI18n();
    // True when the server already resolved this data. A successful *empty*
    // response counts as resolved, so the browser does not re-request a list
    // that is genuinely empty.
    const resolvedOnServer = Array.isArray(initialGroups);

    // Stores the "Bubbles" (Groups)
    const [storyGroups, setStoryGroups] = useState<ApiStoryGroup[]>(initialGroups ?? []);
    // Stores the flat list for the Viewer to navigate through
    const [allStories, setAllStories] = useState<Story[]>(
        resolvedOnServer ? flattenGroups(initialGroups!) : []
    );

    // Start ready when the server already sent the data, so the skeleton is
    // never rendered for content that is already in the HTML.
    const [isLoading, setIsLoading] = useState<boolean>(!resolvedOnServer);
    const [error, setError] = useState<string | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
    const [currentStoryIndex, setCurrentStoryIndex] = useState<number>(0);

    useEffect(() => {
        if (resolvedOnServer) return;

        const fetchAndProcessStories = async () => {
            try {
                const fetchedGroups: ApiStoryGroup[] = await getPublicStories();
                setStoryGroups(fetchedGroups);
                setAllStories(flattenGroups(fetchedGroups));

            } catch (err) {
                setError(err instanceof Error ? err.message : t('stories.error'));
                console.error("Failed to fetch stories:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndProcessStories();
    }, [resolvedOnServer]);

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
        // Circles for the story avatars, a bar for the label under each — the
        // shape the tray will actually take. No "Loading..." text: on a slow
        // connection it would sit on screen for seconds saying nothing useful.
        // The row scrolls sideways exactly like the real Swiper, so a narrow
        // phone shows a few circles and swipes for the rest instead of the
        // whole tray pushing the page wide.
        return (
            <div className="stories-tray-container" aria-busy="true" aria-live="polite">
                <div className="stories-skeleton-scroll">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <div className="story-skeleton" key={i}>
                            <div className="story-skeleton-avatar" />
                            <div className="story-skeleton-label" />
                        </div>
                    ))}
                </div>
            </div>
        );
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
                                <h1 className='title-story-section'>{t('stories.title')}</h1><span className='title-story-section-separite'>|</span>

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
                                        <Image
                                            src={coverImage || '/placeholder-avatar.png'}
                                            alt={`Story by ${group.adminName}`}
                                            // Optional: Add a border if it's a video vs image, or just standard
                                            style={{ objectFit: 'cover' }}
                                            width={66}
                                            height={66}
                                            sizes="66px"
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