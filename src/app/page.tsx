'use client'
import React, { useState, useEffect } from 'react';
import { supabase, Post } from '../lib/supabase';

export default function Wall() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [postImage, setPostImage] = useState<File | null>(null);
  const [charactersRemaining, setCharactersRemaining] = useState(280);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // User configuration
  const userConfig = {
    name: "Reynald Allison Maravilla",
    profileImage: "/1.jpg",
    networks: "Nueva Ecija University of Science and Technology",
    currentCity: "Santo Domingo, Nueva Ecija"
  };

  // Fetch posts
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

  // Format timestamp
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

  // Update timestamps every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setPosts(currentPosts =>
        currentPosts.map(post => ({
          ...post,
          timestamp: formatTimestamp(post.created_at)
        }))
      );
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPosts(); }, []);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('posts_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          const newPost = {
            ...payload.new as Post,
            timestamp: 'now'
          };
          setPosts(current => [newPost, ...current]);
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts(current =>
            current.map(post =>
              post.id === payload.new.id
                ? { ...payload.new as Post, timestamp: formatTimestamp(payload.new.created_at) }
                : post
            )
          );
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          setPosts(current => current.filter(post => post.id !== payload.old.id));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handlePostChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 280) {
      setNewPost(value);
      setCharactersRemaining(280 - value.length);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }
      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
        alert('Only JPEG, PNG, and GIF images are allowed');
        return;
      }
      setPostImage(file);
    }
  };

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newPost.trim() && !postImage) || posting) return;

    setPosting(true);
    let imageUrl: string | null = null;

    try {
      // Handle image upload
      if (postImage) {
        const fileExt = postImage.name.split('.').pop()?.toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filePath, postImage);

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      // Create post without authentication check
      const { error: postError } = await supabase
        .from('posts')
        .insert({
          author: userConfig.name,
          content: newPost.trim(),
          image_url: imageUrl,
          created_at: new Date().toISOString()
        });

      if (postError) throw new Error(`Post creation failed: ${postError.message}`);

      // Reset form and refresh
      setNewPost('');
      setPostImage(null);
      setCharactersRemaining(280);
      await fetchPosts();

    } catch (error) {
      console.error('Error:', error);
      alert(error instanceof Error ? error.message : 'Failed to create post');
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
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">{userConfig.name}&apos;s Wall</h1>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400' :
              connectionStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
            }`}></div>
            <span className="text-xs">
              {connectionStatus === 'connected' ? 'Live' :
               connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 flex gap-6">
        {/* Left Sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4">
              <div className="flex justify-center mb-4">
                <img 
                  src={userConfig.profileImage}
                  alt={userConfig.name}
                  className="w-48 h-48 object-cover rounded-full border-4 border-gray-200 shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "https://via.placeholder.com/300x300/cccccc/666666?text=Profile";
                  }}
                />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900">{userConfig.name}</h2>
                <div className="text-sm text-gray-600">Wall</div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-4">
              <div className="bg-gray-50 px-3 py-2 rounded-t">
                <h3 className="font-semibold text-gray-700 text-sm">Information</h3>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-b">
                <div className="p-3 border-b border-gray-100">
                  <div className="font-medium text-gray-600 text-sm mb-1">Networks</div>
                  <div className="text-gray-800">{userConfig.networks}</div>
                </div>
                <div className="p-3">
                  <div className="font-medium text-gray-600 text-sm mb-1">Current City</div>
                  <div className="text-gray-800">{userConfig.currentCity}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
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

              <div className="mb-3">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={posting}
                />
              </div>

              {postImage && (
                <div className="mb-3">
                  <img 
                    src={URL.createObjectURL(postImage)} 
                    alt="Preview" 
                    className="max-h-48 rounded border"
                  />
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {charactersRemaining} characters remaining
                </span>
                <button
                  type="submit"
                  disabled={( !newPost.trim() && !postImage ) || posting}
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
                  <p className="text-gray-800 leading-relaxed mb-2">{post.content}</p>
                  {post.image_url && (
                    <img 
                      src={post.image_url} 
                      alt="Post" 
                      className="rounded max-h-96 object-contain border"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
