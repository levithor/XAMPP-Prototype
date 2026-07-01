exports.uploadImage = async (req,res)=>{

    if(!req.file){
        return res.status(400).json({
            message:"No image uploaded"
        });
    }

    console.log(req.file);

    res.json({
        filename:req.file.filename,
        path:req.file.path
    });

}