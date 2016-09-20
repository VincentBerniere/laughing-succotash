package com.vince.model;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * Created by vince on 07/09/16.
 */
@Component
public class DatabaseLoader implements CommandLineRunner {

    private final ProjectRepository repository;

    @Autowired
    public DatabaseLoader(ProjectRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... strings) throws Exception {

        this.repository.save(new Project(
                "Amicale GIL",
                "Amicale GIL (Génie de l'Informatique Logicielle) is a University Project.",
                "https://github.com/yoannfleurydev/amicale-src",
                "https://raw.githubusercontent.com/yoannfleurydev/amicale-src/master/web/img/logo.png",
                "15/09/2016"));
    }
}
