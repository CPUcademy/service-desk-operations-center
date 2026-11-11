package com.sdoc.sdoc;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SDOCController {

    @GetMapping
    public String test(){
        return "bajo jajo";
    }
    @PostMapping
    public String test2(){
        return "bajo jajo";
    }

}
