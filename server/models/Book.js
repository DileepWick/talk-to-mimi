// models/Book.js
import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Book title is required'],
  },
  isbn: {
    type: String,
    required: [true, 'ISBN number is required'],
    unique: true,
  },
  author: {
    type: String,
    required: [true, 'Author name is required'],
  },
});

const Book = mongoose.model('Book', bookSchema);
export default Book;
