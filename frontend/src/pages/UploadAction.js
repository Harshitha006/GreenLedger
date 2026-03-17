import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../services/api';
import toast from 'react-hot-toast';

const UploadSchema = Yup.object().shape({
    actionType: Yup.string()
        .required('Please select an action type'),
    userInput: Yup.string()
        .optional(),
});

const actionTypes = [
    { value: 'electricity', label: 'Electricity Saving', icon: '⚡' },
    { value: 'solar', label: 'Solar Installation', icon: '☀️' },
    { value: 'ev', label: 'EV Charging', icon: '🚗' },
    { value: 'transport', label: 'Public Transport', icon: '🚇' },
    { value: 'water', label: 'Water Conservation', icon: '💧' },
    { value: 'waste', label: 'Waste Management', icon: '♻️' },
    { value: 'tree', label: 'Tree Plantation', icon: '🌳' },
];

const UploadAction = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [previews, setPreviews] = useState([]);

    const onDrop = useCallback((acceptedFiles) => {
        setFiles(prev => [...prev, ...acceptedFiles]);

        // Generate previews for images
        acceptedFiles.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = () => {
                    setPreviews(prev => [...prev, { file: file.name, url: reader.result }]);
                };
                reader.readAsDataURL(file);
            } else {
                setPreviews(prev => [...prev, { file: file.name, url: null, type: file.type }]);
            }
        });
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        },
        maxSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
    });

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (values, { setSubmitting }) => {
        if (files.length === 0) {
            toast.error('Please upload at least one proof document');
            setSubmitting(false);
            return;
        }

        setUploading(true);

        const formData = new FormData();
        files.forEach(file => {
            formData.append('proofs', file);
        });
        formData.append('actionType', values.actionType);
        if (values.userInput) {
            formData.append('userInput', JSON.stringify({ notes: values.userInput }));
        }

        try {
            // Use the configured api service — it auto-attaches the Bearer token
            await api.post('/actions/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            toast.success('Action uploaded successfully! Verification in progress.');
            navigate('/dashboard');
        } catch (error) {
            console.error('Upload error:', error.response || error);
            const message =
                error.response?.data?.errors?.[0]?.msg ||
                error.response?.data?.message ||
                'Upload failed. Please try again.';
            toast.error(message);
        } finally {
            setUploading(false);
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Upload Sustainability Action</h1>

            <div className="bg-white rounded-xl shadow-md p-6">
                <Formik
                    initialValues={{
                        actionType: '',
                        userInput: '',
                    }}
                    validationSchema={UploadSchema}
                    onSubmit={handleSubmit}
                >
                    {({ isSubmitting, values }) => (
                        <Form className="space-y-6">
                            {/* Action Type Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Select Action Type
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {actionTypes.map(type => (
                                        <label
                                            key={type.value}
                                            className={`
                                    relative flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer
                                    ${values.actionType === type.value
                                        ? 'border-primary-600 bg-primary-50'
                                        : 'border-gray-200 hover:border-gray-300'}
                      `}
                    >
                                    <Field
                                        type="radio"
                                        name="actionType"
                                        value={type.value}
                                        className="sr-only"
                                    />
                                    <div className="text-center">
                                        <span className="text-2xl block mb-2">{type.icon}</span>
                                        <span className="text-sm font-medium">{type.label}</span>
                                    </div>
                                </label>
                  ))}
                            </div>
                            <ErrorMessage name="actionType" component="p" className="mt-2 text-sm text-red-600" />
                        </div>

              {/* File Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Upload Proof Documents
                        </label>
                        <div
                            {...getRootProps()}
                            className={`
                        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                        ${isDragActive ? 'border-primary-600 bg-primary-50' : 'border-gray-300 hover:border-gray-400'}
                  `}
                >
                        <input {...getInputProps()} />
                        <div className="space-y-2">
                            <div className="text-4xl mb-4">📎</div>
                            {isDragActive ? (
                                <p className="text-primary-600">Drop the files here...</p>
                            ) : (
                                <>
                                    <p className="text-gray-600">
                                        Drag & drop files here, or click to select
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        Supported: Images, PDF, DOC (Max 10MB each, up to 5 files)
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
            </div>

            {/* File Previews */}
            {previews.length > 0 && (
                <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files ({previews.length})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {previews.map((preview, index) => (
                            <div key={index} className="relative group">
                                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                    {preview.url ? (
                                        <img
                                            src={preview.url}
                                            alt={`Preview ${index + 1}`}
                                    className="w-full h-full object-cover"
                            />
                                    ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                                        📄
                                    </div>
                          )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeFile(index)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                                <p className="text-xs text-gray-500 mt-1 truncate">{preview.file}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Additional Notes */}
            <div>
                <label htmlFor="userInput" className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (Optional)
                </label>
                <Field
                    as="textarea"
                    id="userInput"
                    name="userInput"
                    rows="3"
                    className="input-field"
                    placeholder="Any additional information about this action..."
                />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3">
                <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="btn-secondary"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting || uploading || files.length === 0}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {uploading ? (
                        <div className="flex items-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Uploading...
                        </div>
                    ) : (
                        'Submit Action'
                    )}
                </button>
            </div>
        </Form>
    )
}
        </Formik >
      </div >

    {/* Tips Section */ }
    < div className = "mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6" >
        <h3 className="text-lg font-semibold text-blue-800 mb-3">📝 Tips for Faster Verification</h3>
        <ul className="space-y-2 text-blue-700">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            Upload clear, high-quality images of your bills
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            Make sure all details (bill number, units, date) are visible
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            For electricity bills, upload both previous and current month
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            Avoid uploading the same document multiple times
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            Do not edit or modify the original documents
          </li>
        </ul>
      </div >
    </div >
  );
};

export default UploadAction;
