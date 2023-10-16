import Course from "../models/course.model.js";
import AppError from "../Utils/error.util.js";
import cloudinary from 'cloudinary';
import fs from 'fs/promises';
import path from 'path';


const getAllCourses = async function(req, res, next) {
      try{
        const courses = await Course.find({}).select('-lectures');

        res.status(200).json({
            success: true,
            message: 'All courses',
            courses,
        });
      } catch(e){
        return next(
            new AppError(e.message, 500)
        )
      }
}

const getLecturesByCourseId = async function(req, res, next) {
    try{
       const {id} = req.params;

       const course = await Course.findById(id);

       if(!course) {
          return next(
            new AppError('Invalid course Id', 400)
          )
       }

       res.status(200).json({
        success: true,
        message: 'Course lectures fetched successfully',
        lectures: course.lectures
       });
    } catch(e) {
        return next(
            new AppError(e.message, 500)
        )
    }
}

const createCourse = async (req, res, next) => {
    const { title, description, category, createdBy } = req.body;

    if (!title || !description || !category || !createdBy){
      return next(new AppError('All fields are required', 400))
    }

    const course = await Course.create({
      title,
      description,
      category,
      createdBy,
      thumbnail: {
        public_id: 'Dummy',
        secure_url: 'Dummy',
      }
    });

    if (!course) {
      return next(
        new AppError('Course could not be created, please try again', 400)
      );
    }
   
    if(req.file){
      try {
        const result = await cloudinary.v2.uploader.upload(req.file.path, {
          folder: 'lms'
        });
        if(result) {
          course.thumbnail.public_id = result.public_id;
          course.thumbnail.secure_url = result.secure_url;
        }
        fs.rm(`uploads/${req.file.filename}`);
      } catch(e){
        return next(
          new AppError(e.message, 500)
        );
      }
    }
    await course.save();

  res.status(201).json({
    success: true,
    message: 'Course created successfully',
    course,
  });

}

const updateCourse = async (req, res, next) => {
    try{
      const {id} = req.params;
      const course = await Course.findByIdAndUpdate(
        id,
        {
          $set: req.body
        },
        {
          runValidators: true
        }
      );
      if (!course) {
        return next(new AppError('Course with given id does not exist', 500));
      }
      res.status(200).json({
        success: true,
        message: 'Course updated successfully',
        course
      });

    } catch(e){
      return next(
        new AppError(e.message, 500)
      );
    }
}

const removeCourse = async (req, res, next) => {
     try {
        const {id} = req.params;
        const course = await Course.findById(id);

        if(!course) {
          return next(new AppError('Course with given id does not exist', 500));
        }
        await Course.findByIdAndDelete(id);

        res.status(200).json({
          success: true,
          message: 'Course deleted successfully'
        })

     
      } catch(e) {
      return next(
        new AppError(e.message, 500)
      );
     }
}

const addLectureToCourseById = async (req, res, next) => {
  const { title, description } = req.body;
  const { id } = req.params;

  let lectureData = {};

  if (!title || !description) {
    return next(new AppError('Title and Description are required', 400));
  }

  const course = await Course.findById(id);

  if (!course) {
    return next(new AppError('Invalid course id or course not found.', 400));
  }

  // Run only if user sends a file
  if (req.file) {
    try {
      const result = await cloudinary.v2.uploader.upload(req.file.path, {
        folder: 'lms', // Save files in a folder named lms
        chunk_size: 50000000, // 50 mb size
        resource_type: 'video',
      });

      // If success
      if (result) {
        // Set the public_id and secure_url in array
        lectureData.public_id = result.public_id;
        lectureData.secure_url = result.secure_url;
      }

      // After successful upload remove the file from local storage
      fs.rm(`uploads/${req.file.filename}`);
    } catch (error) {
      // Empty the uploads directory without deleting the uploads directory
      for (const file of await fs.readdir('uploads/')) {
        await fs.unlink(path.join('uploads/', file));
      }

      // Send the error message
      return next(
        new AppError(
          JSON.stringify(error) || 'File not uploaded, please try again',
          400
        )
      );
    }
  }

  course.lectures.push({
    title,
    description,
    lecture: lectureData,
  });

  course.numbersOfLectures = course.lectures.length;
  

  // Save the course object
  await course.save();

  res.status(200).json({
    success: true,
    message: 'Course lecture added successfully',
    course,
  });
}

const removeLectureFromCourse = async (req, res, next) => {
  const { courseId, lectureId } = req.query;

  if (!courseId) {
    return next(new AppError('Course ID is required', 400));
  }

  if (!lectureId) {
    return next(new AppError('Lecture ID is required', 400));
  }

  const course = await Course.findById(courseId);

  if (!course) {
    return next(new AppError('Invalid ID or Course does not exist.', 404));
  }

  const lectureIndex = course.lectures.findIndex(
    (lecture) => lecture._id.toString() === lectureId.toString()
  );

  if (lectureIndex === -1) {
    return next(new AppError('Lecture does not exist.', 404));
  }

  await cloudinary.v2.uploader.destroy(
    course.lectures[lectureIndex].lecture.public_id,
    {
      resource_type: 'video',
    }
  );

  course.lectures.splice(lectureIndex, 1);

  course.numbersOfLectures = course.lectures.length;

  await course.save();

  res.status(200).json({
    success: true,
    message: 'Course lecture removed successfully',
  });

}


export {
    getAllCourses,
    getLecturesByCourseId,
    createCourse,
    updateCourse,
    removeCourse,
    addLectureToCourseById,
    removeLectureFromCourse
}