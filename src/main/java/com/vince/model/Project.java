package com.vince.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.Version;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.util.Date;

@Data
@Entity
public class Project {

    private @Id @GeneratedValue Long id;
    private String name;
    private String description;
    private String link;
    private String imageLink;
    private String date;

    private @Version @JsonIgnore Long version;

    private Project() {}

    public Project(String name, String description, String link, String imageLink, String date) {
        this.name = name;
        this.description = description;
        this.link = link;
        this.imageLink = imageLink;
        this.date = date;
    }

    public Long getId() {
        return  this.id;
    }
}