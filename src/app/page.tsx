// src/app/page.tsx
'use client'
import React, { useState, useEffect } from 'react';
import { supabase, Post } from '../lib/supabase';

export default function Wall() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [charactersRemaining, setCharactersRemaining] = useState(280);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  // Fetch posts from Supabase
  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
        return;
      }

      // Format posts with relative timestamps
      const formattedPosts = data?.map(post => ({
        ...post,
        timestamp: formatTimestamp(post.created_at)
      })) || [];

      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format timestamp to relative time
  const formatTimestamp = (timestamp: string): string => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - postTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d`;
  };

  // Load posts on component mount
  useEffect(() => {
    fetchPosts();
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('posts_changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'posts' 
        }, 
        (payload) => {
          const newPost = {
            ...payload.new as Post,
            timestamp: 'now'
          };
          setPosts(current => [newPost, ...current]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handlePostChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 280) {
      setNewPost(value);
      setCharactersRemaining(280 - value.length);
    }
  };

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || posting) return;

    setPosting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .insert([
          {
            author: 'Greg Wientjes',
            content: newPost.trim()
          }
        ]);

      if (error) {
        console.error('Error posting:', error);
        alert('Failed to post. Please try again.');
        return;
      }

      setNewPost('');
      setCharactersRemaining(280);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Wall...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-500 text-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">Wall</h1>
      </div>

      <div className="max-w-7xl mx-auto p-4 flex gap-6">
        {/* Left Sidebar - Profile Info */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Profile Picture */}
            <div className="p-4">
              <img 
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face" 
                alt="Greg Wientjes" 
                className="w-full h-48 object-cover rounded-lg"
              />
              <div className="mt-4">
                <h2 className="text-xl font-semibold text-gray-900">Greg Wientjes</h2>
                <div className="text-sm text-gray-600">Wall</div>
              </div>
            </div>

            {/* Information Section */}
            <div className="border-t border-gray-200 p-4">
              <div className="bg-gray-50 px-3 py-2 rounded-t">
                <h3 className="font-semibold text-gray-700 text-sm">Information</h3>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-b">
                <div className="p-3 border-b border-gray-100">
                  <div className="font-medium text-gray-600 text-sm mb-1">Networks</div>
                  <div className="text-gray-800">Stanford Alum</div>
                </div>
                
                <div className="p-3">
                  <div className="font-medium text-gray-600 text-sm mb-1">Current City</div>
                  <div className="text-gray-800">Palo Alto, CA</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 max-w-2xl">
          {/* Post Composer */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <form onSubmit={handleSubmitPost}>
              <div className="mb-3">
                <textarea
                  value={newPost}
                  onChange={handlePostChange}
                  disabled={posting}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-lg disabled:bg-gray-50"
                  rows={3}
                  placeholder="What's on your mind?"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {charactersRemaining} characters remaining
                </span>
                <button
                  type="submit"
                  disabled={!newPost.trim() || posting}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded transition-colors flex items-center gap-2"
                >
                  {posting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  {posting ? 'Sharing...' : 'Share'}
                </button>
              </div>
            </form>
          </div>

          {/* Posts Feed */}
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <p className="text-gray-500">No posts yet. Be the first to share something!</p>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900">{post.author}</h3>
                    <span className="text-sm text-gray-500">{post.timestamp}</span>
                  </div>
                  <p className="text-gray-800 leading-relaxed">{post.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}