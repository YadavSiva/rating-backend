const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


const app = express();
const PORT = 7000;

app.use(bodyParser.json());
app.use(cors({
  origin: 'http://localhost:3000',
}));


const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'your_secret_key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = { userId: user.userId };
    next();
  });
};
mongoose.connect('mongodb+srv://sivaramsynergyuniversal123:sivaram@cluster0.rjsb5om.mongodb.net/projectD', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define the user schema
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,

});

const ratingReviewSchema = new mongoose.Schema({
  serviceName: String,
  reviews: [
    {
      _id: mongoose.Schema.Types.ObjectId,
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rating: Number,
      review: String,
      userName: String,
    }
  ]
});

const User = mongoose.model('User', userSchema);
const RatingReview = mongoose.model('RatingReview', ratingReviewSchema);

app.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    await newUser.save();
    res.status(201).json({ message: 'User signed up successfully!' });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ error: 'Failed to sign up.' });
  }
});
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      const token = jwt.sign({ userId: user._id }, 'your_secret_key');

      res.status(200).json({ token, username: user.firstName });
    } else {
      res.status(401).json({ error: 'Incorrect password.' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});
app.post('/submit-rating-review', authenticateToken, async (req, res) => {
  try {
    const { rating, review, servicename } = req.body;
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    let ratingReview = await RatingReview.findOne({ serviceName: servicename });

    if (!ratingReview) {
      ratingReview = new RatingReview({
        serviceName: servicename,
        reviews: []
      });
    }
    ratingReview.reviews.push({
      _id: new mongoose.Types.ObjectId(),
      userId: userId,
      rating: rating,
      review: review,
      userName: `${user.firstName} ${user.lastName}`,
    });

    await ratingReview.save();

    res.status(201).json({ message: 'Rating and review submitted successfully!' });
  } catch (error) {
    console.error('Error submitting rating and review:', error);
    res.status(500).json({ error: 'Failed to submit rating and review.' });
  }
});


app.get('/get-username', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(200).json({ username: user.firstName });
  } catch (error) {
    console.error('Error fetching username:', error);
    res.status(500).json({ error: 'Failed to fetch username.' });
  }
});

app.get('/get-ratings-reviews', async (req, res) => {
  try {
    const { servicename } = req.query;
    const ratingsReviews = await RatingReview.findOne({ serviceName: servicename });
    if (!ratingsReviews) {
      return res.status(404).json({ error: 'No reviews found for this hotel' });
    }
    res.status(200).json(ratingsReviews.reviews);
  } catch (error) {
    console.error('Error fetching ratings and reviews:', error);
    res.status(500).json({ error: 'Failed to fetch ratings and reviews.' });
  }
});
app.put('/update-rating-review/:id', authenticateToken, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const reviewId = req.params.id;
    const userId = req.user.userId;
    
    const existingReview = await RatingReview.findOne({ 'reviews._id': reviewId });
    if (!existingReview) {
      console.error(`Review with id ${reviewId} not found.`);
      return res.status(404).json({ error: 'Review not found.' });
    }

    const reviewToUpdate = existingReview.reviews.find(r => r._id.toString() === reviewId);
    if (!reviewToUpdate) {
      console.error(`Review to update with id ${reviewId} not found within existing reviews.`);
      return res.status(404).json({ error: 'Review not found within the service.' });
    }
    if (reviewToUpdate.userId.toString() !== userId) {
      console.error(`User ${userId} does not have permission to edit review ${reviewId}.`);
      return res.status(403).json({ error: 'You do not have permission to edit this review.' });
    }

    reviewToUpdate.rating = rating;
    reviewToUpdate.review = review;

    await existingReview.save();
    console.log(`Review ${reviewId} updated successfully by user ${userId}.`);
    res.status(200).json({ message: 'Review updated successfully!' });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review.' });
  }
});

app.delete('/delete-rating-review/:id', async (req, res) => {
  try {
    const reviewId = req.params.id;
    const userId = req.user.userId;
    const existingReview = await RatingReview.findOne({ 'reviews._id': reviewId });
    if (!existingReview) {
      return res.status(404).json({ error: 'Review not found.' });
    }
    const reviewToDelete = existingReview.reviews.find(review => review._id.toString() === reviewId);
    if (reviewToDelete.userId.toString() !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this review.' });
    }
    existingReview.reviews = existingReview.reviews.filter(review => review._id.toString() !== reviewId);
    await existingReview.save();

    res.status(200).json({ message: 'Review deleted successfully!' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review.' });
  }
});
app.get('/get-average-rating', async (req, res) => {
  try {
    const { servicename } = req.query;
    const ratings = await RatingReview.find({ serviceName: servicename }, 'reviews.rating');
    let totalRating = 0;
    let totalRatings = 0;
    ratings.forEach((rating) => {
      rating.reviews.forEach((review) => {
        totalRating += review.rating;
        totalRatings++;
      });
    });
    const averageRating = totalRating / totalRatings;

    res.status(200).json({ averageRating, totalReviews: totalRatings });
  } catch (error) {
    console.error('Error getting average rating:', error);
    res.status(500).json({ error: 'Failed to get average rating.' });
  }
});

const reportSchema = new mongoose.Schema({
  reviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RatingReview',
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Report = mongoose.model('Report', reportSchema);

app.post('/report-review/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.userId;
  try {
    const existingReview = await RatingReview.findOne({ 'reviews._id': id });
    if (!existingReview) {
      return res.status(404).json({ error: 'Review not found.' });
    }
    const report = new Report({
      reviewId: id,
      reason,
      userId
    });
    await report.save();
    res.status(200).json({ message: 'Review reported successfully' });
  } catch (error) {
    console.error('Error reporting review:', error);
    res.status(500).json({ error: 'An error occurred while reporting the review' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});