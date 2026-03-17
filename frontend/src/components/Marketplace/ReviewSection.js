import React, { useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ReviewSection = ({ reviews = [], onAddReview, title = "Reviews" }) => {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!comment.trim()) {
            toast.error('Please enter a comment');
            return;
        }

        setIsSubmitting(true);
        try {
            await onAddReview({ rating, comment });
            setComment('');
            setRating(5);
            toast.success('Review added successfully');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add review');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mt-12 space-y-8">
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">{title} ({reviews.length})</h3>
                <div className="flex items-center space-x-1">
                    <span className="text-yellow-400 text-xl font-bold">★</span>
                    <span className="text-xl font-bold text-gray-900">
                        {reviews.length > 0 
                            ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
                            : '0.0'}
                    </span>
                </div>
            </div>

            {/* Add Review Form */}
            <form onSubmit={handleSubmit} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <h4 className="text-lg font-bold mb-4">Share your experience</h4>
                <div className="flex items-center space-x-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className={`text-2xl transition-all focus:outline-none ${
                                star <= rating ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-200'
                            }`}
                        >
                            ★
                        </button>
                    ))}
                    <span className="ml-2 text-sm text-gray-500 font-medium">
                        {rating} / 5 stars
                    </span>
                </div>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell others about this..."
                    className="w-full h-32 p-4 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none"
                    maxLength={500}
                ></textarea>
                <div className="flex justify-end mt-4">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`px-8 py-3 rounded-xl font-bold text-white transition-all ${
                            isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-200'
                        }`}
                    >
                        {isSubmitting ? 'Posting...' : 'Post Review'}
                    </button>
                </div>
            </form>

            {/* Reviews List */}
            <div className="space-y-6">
                {reviews.length > 0 ? (
                    reviews.map((review, index) => (
                        <div key={index} className="flex space-x-4 p-4 hover:bg-gray-50 rounded-2xl transition-colors">
                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold">
                                    {review.userName?.charAt(0) || 'U'}
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <h5 className="font-bold text-gray-900">{review.userName || 'Anonymous User'}</h5>
                                    <span className="text-sm text-gray-500">
                                        {format(new Date(review.createdAt), 'dd MMM yyyy')}
                                    </span>
                                </div>
                                <div className="flex text-yellow-400 text-sm mb-2">
                                    {[...Array(5)].map((_, i) => (
                                        <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                                    ))}
                                </div>
                                <p className="text-gray-600 leading-relaxed">{review.comment}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl text-gray-500 italic">
                        No reviews yet. Be the first to share your thoughts!
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewSection;
